# 11 · 第 3 章验收题、TCP 粘包与消息边界

第 3 章末尾四道题，专门考 **Channel 能不能进 Selector、非阻塞 API 的返回值、TCP 字节流 vs UDP 数据报**。
这一章给出标准答案，并单独把「粘包」讲清楚。建议先自己答 [03-channel.md](03-channel.md) 第 8 节，再对照。

可运行代码：

- `com.nio.learn.framing.LengthPrefixedCodec` — 4 字节大端长度 + payload
- `com.nio.learn.framing.TcpStickyPacketDemo` — 一次 `write` 粘两帧，对端仍拆出两条业务消息
- `com.nio.learn.framing.UdpDatagramBoundaryDemo` — 两次 `send` 就是两次 `receive`
- `com.nio.learn.framing.NonBlockingConnectDemo` — `connect` 返回 `false` 后必须 `finishConnect`

```bash
mvn -q test -Dtest=FramingLabTest,NonBlockingConnectTest
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args=framing
```

---

## 1. FileChannel 为何不能进 Selector？

**因为 `FileChannel` 不是 `SelectableChannel`，也不能设成非阻塞。**

`Selector.register(...)` 的接收者类型是 `SelectableChannel`。类层次是：

```
Channel
 ├─ SelectableChannel          才能 register(Selector, ops)
 │    ├─ SocketChannel
 │    ├─ ServerSocketChannel
 │    ├─ DatagramChannel
 │    └─ Pipe.SourceChannel / SinkChannel
 └─ FileChannel                走 AbstractInterruptibleChannel，到此为止
```

两层原因，缺一不可：

| 层 | 事实 |
| --- | --- |
| API | `FileChannel` 没有 `configureBlocking` / `register`。写 `fileChannel.register(selector, OP_READ)` 编译不过。 |
| 模型 | Selector 问的是「这个套接字现在能不能 accept / connect / read / write 而不阻塞」。普通文件在 POSIX 上对 `read` 几乎总是就绪（或卡在磁盘上），用 epoll 去「等文件可读」没有 TCP 那种就绪语义。文件要用阻塞 `FileChannel`、线程池，或 `AsynchronousFileChannel`。 |

只答「没继承 `SelectableChannel`」是对的，但不完整：就算强行包装，文件通道也 **不能** `configureBlocking(false)`。注册 Selector 的前置条件是 **非阻塞的 `SelectableChannel`**。

---

## 2. 非阻塞 `accept()` 返回 `null` 时该做什么？

**什么都不做：直接返回。不要碰那个返回值。**

常见误答：「把返回的 client 配成非阻塞，然后读数据」。那是 **`accept()` 返回了真正的 `SocketChannel`** 时才做的事。返回 `null` 表示 **此刻监听队列里没有待接受的连接**。对 `null` 调 `configureBlocking` 会 NPE。

JDK 语义（`ServerSocketChannel.accept`）：

- 阻塞模式：没有连接就一直堵着，直到来了或出错。
- 非阻塞模式：没有连接 **立即返回 `null`**，不是抛异常。
- 返回的 `SocketChannel`（如果有）**永远是阻塞模式**，和监听通道当前是否非阻塞无关。

正确处理：

```java
SocketChannel client = server.accept();
if (client == null) {
    return;                       // 没有连接，结束本次 OP_ACCEPT
}
client.configureBlocking(false);  // 必须先改非阻塞再 register
client.register(selector, SelectionKey.OP_READ, new Conn());
```

因为 Java Selector 在 Linux 上是水平触发，一次 `OP_ACCEPT` 队列里可能挤了多个连接。更稳的写法是 **循环到 `null`**：

```java
SocketChannel client;
while ((client = server.accept()) != null) {
    client.configureBlocking(false);
    client.register(selector, SelectionKey.OP_READ, new Conn());
}
```

本仓库 `NioEchoServer.accept()` 就是「`null` 则 return」。

---

## 3. `connect` 之后为什么还要 `finishConnect`？

**非阻塞 `connect()` 只是发起 TCP 三次握手，握手可能还没结束。`finishConnect()` 才把连接状态收尾；失败也是在这里变成 `IOException`。**

阻塞模式：`connect(addr)` 会堵住直到成功或抛错，调用方拿到的通道已经连上。

非阻塞模式（JDK `SocketChannel.connect`）：

1. `configureBlocking(false)`
2. `connect(addr)`  
   - 返回 `true`：本机回环等情况下握手立刻完成，可以直接读写。  
   - 返回 `false`：握手还在进行（`isConnectionPending() == true`）。此时 **还不能 `read` / `write`**，否则 `NotYetConnectedException`。
3. 把通道注册到 Selector，兴趣为 `OP_CONNECT`。
4. `isConnectable()` 为真时调用 `finishConnect()`：  
   - 返回 `true`：连上了，把兴趣改成 `OP_READ`（或 `OP_WRITE`）。  
   - 返回 `false`：仍未完成，继续等。  
   - 抛 `IOException`：对端拒绝、超时、路由失败。不调 `finishConnect` 就观察不到这次失败。

`connect` 和 `finishConnect` 拆开，是为了让线程去干别的连接，而不是堵在三次握手上。忘记 `finishConnect` 是客户端最常见的坑：通道看起来「已经 connect 过了」，其实还停在 pending。

示例见 `NonBlockingConnectDemo`。

---

## 4. UDP 为什么没有 TCP 那种「粘包」，却仍要处理不完整业务帧？

**UDP 按数据报交付：一次 `send` 对应一次 `receive`，内核不会把两次发送粘成一次接收。但不完整业务帧仍然存在，因为「数据报边界」≠「你的业务消息边界」。**

TCP 是 **字节流**：没有消息边界。内核、Nagle、MSS、接收窗口都可以把多次 `write` 拼在一起，或把一次 `write` 拆开。这就是粘包 / 半包。

UDP 是 **数据报**：

| 现象 | TCP | UDP |
| --- | --- | --- |
| 两次 `write` / `send` 会不会被合成一次 `read` / `receive` | 会（粘包） | 不会 |
| 一次发送会不会被拆成多次接收 | 会（半包 / 拆包） | 不会；一个数据报要么整份到，要么不到 |
| 丢失、乱序、重复 | 连接内可靠、有序 | 会 |
| 接收 Buffer 太小 | 剩余字节下次还能读到 | **多出来的字节被丢弃**（截断） |

所以「没有 TCP 粘包」只说明：**内核不会把两个 UDP 包粘成一个。** 你自己在应用层拼消息时，不完整帧照样来：

1. **你把一条业务消息切成多个 UDP 包**（分片、自定义序号）。丢包、乱序会让拼出来的消息缺一块。这不是粘包，是不可靠传输。
2. **你把多条业务记录塞进同一个数据报**。对端一次 `receive` 拿到的是整包字节，内部仍要用长度字段 / 分隔符切开。边界是你封的，不是 UDP 帮你封的。
3. **`ByteBuffer` 小于数据报**。`receive` 只填满 Buffer，剩余丢弃，业务帧被截断。
4. **IP 层分片重组失败**。整份数据报消失，你等到的是「这一条业务消息永远不完整」。

`UdpDatagramBoundaryDemo` 演示：连发两个数据报，两次 `receive` 仍是两条；Buffer 过小则截断。

---

## 5. 什么是 TCP 的粘包？

**粘包：一次 `read` 里出现了多于一条完整业务消息的字节。**  
**半包（拆包）：一条业务消息的字节被拆到多次 `read` 里，这一次不够拼出整条。**

它们是同一件事的两面：TCP 只保证字节有序到达，**不保证「一次 `write` = 一次 `read` = 一条消息」**。

```
发送方业务：  [消息A]     [消息B]
               write()      write()
                    \        /
内核 TCP 流：  AAAAAAAAAAAAAAAAAABBBBBBBB
                    /        \
接收方 read： [消息A + 消息B的一部分]  [消息B剩余]
                 ↑ 粘包 + 半包           ↑ 半包收尾
```

成因（常叠加）：

- **协议本身是流**：没有记录边界。
- **Nagle**：小包在发送缓冲里合并（`TCP_NODELAY` 只能减少合并，不能创造消息边界）。
- **MSS / 网卡 MTU**：一次大 `write` 被切成多个 TCP 段。
- **接收方读得慢或 `ByteBuffer` 较小**：内核接收缓冲里已经堆了多条消息，一次 `read` 全抄走。
- **应用缓冲**：你自己 `compact` 之前的累计区里本来就有半包，新数据贴上去看起来像粘在一起。

UDP 没有这种「流式合并 / 流式拆分」。把 UDP 的截断、丢包叫「粘包」是概念用错。

---

## 6. 粘包怎么解决？

**在应用层给字节流加上消息边界，并且每个连接自己保留一个累计缓冲。**  
NIO、Netty、操作系统都不会替你按「一条业务消息」切开 TCP。

### 6.1 接收端固定要做的事

1. **每个连接一个 inbound Buffer**（不要每次事件 `allocate`，也不要多连接共用）。
2. `read` 到累计区后尝试解码；成功就消费这些字节，失败就把半包 `compact` 留下。
3. 循环解码，直到累计区不够一条完整帧——一次 `read` 可能含多帧（粘包）。
4. 规定 **最大帧长**。长度字段被改成 2GB 时要立刻断开，否则内存被打爆。
5. 解码失败（长度非法、找不到分隔符超过上限）**关连接**，不要空转。

`LengthPrefixedCodec.Decoder.feed` 就是这个循环：不够头 → 等；头里的 length 超限 → 抛错；不够 body → 等；够了就切出一帧，再看后面还有没有。

### 6.2 三种划界方式

| 方式 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 定长 | 每条消息 N 字节，短的补填充 | 实现最简单 | 浪费带宽；变长内容别扭 |
| 分隔符 | 以 `\n`、`\r\n` 或特殊字节结束 | 文本协议直观 | 内容里出现分隔符要转义；二进制不适用 |
| 长度字段（推荐） | `4 字节大端 length + payload`，即 TLV / Length-Value | 二进制友好，和 HTTP/gRPC 帧同类 | 必须校验 length；注意大小端 |

本仓库 Echo / Chat 用分隔符 `\n`。Scatter/Gather 示例和本章 Demo 用长度字段。

长度字段推荐约定：

- 4 字节、**大端**（网络字节序），值 = payload 字节数，不含这 4 字节自己。
- 读的时候用 `ByteOrder.BIG_ENDIAN`，不要依赖 JVM 默认（x86 是小端）。
- 先 peek 长度，确认 `remaining >= 4 + length` 再真正消费。只读到 2 个长度字节时不要 `getInt()`，那会把半个 header 解释成离谱的长度。

定长、分隔符、长度字段可以组合，例如 WebSocket：帧头里带 payload length。

### 6.3 发送端也要配套

粘包不只是接收问题。`write` 可能只写出一部分（半包的对偶：**半写**）：

```
channel.write(buf)
  buf 还有 remaining → 注册 OP_WRITE，下次接着写
  写完             → 去掉 OP_WRITE
```

Gather 可以把 header、body 两个 Buffer 一次 `write(ByteBuffer[])`，减少「头写下了、体还在用户态」的窗口，但 TCP 仍可能把它们粘到下一帧后面。所以 **发送用 Gather 不能代替接收端解码**。

### 6.4 关不掉的误解

- 关 Nagle（`TCP_NODELAY`）**不是**粘包解决方案，只是少合并小包、降低延迟。
- 每次消息后 `flush` / 短连接「发完就关」只能用于玩具，不能当协议。
- 加睡眠、等「包与包之间的间隙」在广域网上会失效。
- 换 UDP 能去掉粘包，但会换来丢包、乱序、截断，业务帧协议照样要做。

生产环境把这一套写成 Netty 的 `LengthFieldBasedFrameDecoder` + `LengthFieldPrepender`。学完本章再看 [10-from-nio-to-netty.md](10-from-nio-to-netty.md) 会知道 Decoder 在 Pipeline 里为什么必须排在业务 Handler 前面。

---

## 7. 四道题的标准答案（对照表）

| 问题 | 标准答案 | 常见错答 |
| --- | --- | --- |
| FileChannel 为何不能进 Selector？ | 不是 `SelectableChannel`，也不能非阻塞。文件 I/O 没有套接字那种就绪语义。 | 只说「文件是阻塞的」但说不清类型层次 |
| 非阻塞 `accept()` 返回 `null`？ | 没有待接受连接，直接 return。有连接时才 `configureBlocking(false)` 再 `register`。 | 对 `null` 配置非阻塞并读数据 |
| 为何还要 `finishConnect`？ | 非阻塞 `connect` 只发起握手；`finishConnect` 完成握手并把失败变成异常。 | 以为 `connect` 返回后就能读写 |
| UDP 无粘包为何还有不完整帧？ | 数据报边界不是业务边界：自切包会丢/乱序，Buffer 过小会截断，同一数据报内部仍要划界。 | 「UDP 可靠」或「UDP 完全不用解码」 |

---

## 8. 建议动手

1. `LabRunner framing`：看一次 TCP 写入两帧、对端拆出两条；UDP 两次发送仍是两次接收。
2. 读 `LengthPrefixedCodec.Decoder`，对照第 6 节的循环。
3. 跑 `FramingLabTest`：粘包、半个 header、半个 body、非法长度、UDP 截断。
4. 跑 `NonBlockingConnectTest`：`connect` 返回 `false` 时必须 `finishConnect` 才 `isConnected()`。
5. 回头看 `NioEchoServer.drainLines`：那是分隔符版的同一套逻辑。

## 9. 本阶段验收

- 粘包和半包能否用同一套累计 Buffer + 划界规则处理？
- 长度字段为什么要先 peek 再消费？
- 为什么 `TCP_NODELAY` 解决不了粘包？
- UDP `receive` 的 Buffer 比数据报短时，剩下的字节还能下次读到吗？
