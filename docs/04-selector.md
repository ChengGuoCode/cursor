# 04 · Selector：一个线程如何管一万个连接

Selector 是 NIO 网络编程的心脏。模型是：**注册兴趣 → 阻塞/超时等待就绪 → 逐个处理 → 改兴趣 → 再 wait**。

这里的「兴趣」不是日常用语，对应 JDK 原文 **interest set**（兴趣集），读写它的 API 是 `SelectionKey.interestOps` / `interestOps(int)`。含义是：你告诉 Selector，这个 Channel **下一次 `select` 时要检测哪几类操作是否就绪**。四类操作就是下面的 `OP_ACCEPT` / `OP_CONNECT` / `OP_READ` / `OP_WRITE`。

`channel.register(selector, ops)` 里的 `ops` 就是初始 interest set。之后用 `key.interestOps(新值)` 改兴趣——例如写不完时加上 `OP_WRITE`，写完再去掉。

对照另一半：**ready set**（就绪集，`readyOps`）是 Selector 问过内核之后的结果——「这几类现在真的就绪了」。`key.isReadable()` / `isWritable()` / `isAcceptable()` / `isConnectable()` 测的就是 ready set 里有没有对应位。你改不了 ready set，只能改 interest set。

Javadoc 原句：*The interest set determines which operation categories will be tested for readiness the next time one of the selector's selection methods is invoked.*

## 0. Selector 做什么、谁在干活

Selector **不是**执行 accept / read / write 的那个东西，也 **不是**业务状态机。它是一个 **多路复用器（multiplexer）**：把很多 Channel 的「等就绪」合并成一次阻塞调用。Linux 上通常是对 `epoll` 的封装。

本仓库里真正循环干活的是 `NioEchoServer` 的 `loop` 线程（Reactor 事件循环）：

```
loop 线程
    │
    ├─ selector.select(200)     没有就绪事件时，这条线程睡在内核里
    │                           Selector 只回答：「这几个 Channel 的这几类操作现在可以做了」
    │
    └─ accept / read / write    还是 loop 线程自己调 Channel API
                                半包、按行切包、改 interestOps，也都在这条线程里
```

没有 Selector，要么一条连接一条线程堵在 `read()`（BIO），要么自己忙轮询所有 Channel。Selector 的作用就是：**一条（或少数几条）线程，堵住等「谁就绪」，醒来只处理就绪的那些。**

不要把它理解成状态机。状态分散在别处：

| 看起来像状态的东西 | 实际是什么 |
| --- | --- |
| Selector | 等待器 + 三本账：全部 key / 本次就绪的 selected-keys / 已取消的 key |
| `interestOps` | 这根连接「下次想被通知哪几类操作」，很小的兴趣开关，不是协议状态 |
| `Conn.in` / `Conn.out` | 每条连接的累计缓冲，半包活在这里 |
| `drainLines` 找 `\n` | 这才接近协议状态机：够一行就切，不够就留下 |

`select` 返回后，loop 线程按 ready set 分发；处理完改 interest set，再回去 `select`。Selector 只负责「等到了喊你」，不负责「现在该解码还是该关连接」。

`SelectionKey.toString()` 里的数字是 bitmask，不是神秘 ID：

| 十进制 | 位 | 常量 |
| --- | --- | --- |
| 1 | `1 << 0` | `OP_READ` |
| 4 | `1 << 2` | `OP_WRITE` |
| 8 | `1 << 3` | `OP_CONNECT` |
| 16 | `1 << 4` | `OP_ACCEPT` |

所以日志里 `interestOps=16, readyOps=16` 就是「我在听 ACCEPT，而且现在 ACCEPT 就绪了」；`interestOps=1, readyOps=1` 就是「我在听 READ，而且现在可读」。

## 0.1 对照一次 `LabRunner echo` 的时间线

主线程跑 `LabRunner echo`：先 `NioEchoServer.start`（拉起 `loop` 线程），再 `NioEchoClient.sendLines("hello", "NIO")`。  
`loop` 线程里在 `select` 前后打日志，一次真实运行会类似：

```
wait selector                          // loop：select 里睡觉，此时还没有任何连接
echo server 127.0.0.1:53414            // 主线程：start 返回，开始连客户端
wait exit
selectionKey: ...ServerSocketChannel... interestOps=16, readyOps=16
execute over
wait selector
wait exit
selectionKey: ...SocketChannel[...remote=...53426] interestOps=1, readyOps=1
execute over
wait selector
wait exit
selectionKey: ...SocketChannel... interestOps=1, readyOps=1
execute over
wait selector
wait exit
selectionKey: ...SocketChannel... interestOps=1, readyOps=1
execute over
wait selector
echo reply: hello                      // 主线程：客户端已经收齐两行
echo reply: NIO
```

两条线程交叉着走：

1. **`wait selector` 先于 `echo server`**  
   `start()` 里先 `register(OP_ACCEPT)`、再 `loopThread.start()`，然后主线程才打印端口。`loop` 已经堵在 `select` 上。没有连接时它就睡，CPU 接近 0。把超时改成 `select(1000000000)` 只是避免每 200ms 空醒一次把日志打乱；有事件时一样立刻返回。

2. **第一次 `wait exit`：ServerSocketChannel，ops=16**  
   客户端 `SocketChannel.open(地址)` 完成 TCP 握手，连接进了 backlog。Selector 发现监听通道 ACCEPT 就绪。`loop` 调 `accept()`，得到已连接的 `SocketChannel`（对端端口 53426），`configureBlocking(false)`，`register(OP_READ, new Conn())`。  
   这次循环 **只 accept，不读数据**。新通道的兴趣是 1（`OP_READ`），还没进这一轮 `selectedKeys`。

3. **后面三次 `SocketChannel` ops=1**  
   客户端会先连续 `write("hello\n")`、`write("NIO\n")`，再阻塞 `read` 等两行回显。每一次 `wait exit` 只表示：**内核接收缓冲现在有数据（或对端关闭），可以 `read` 而不阻塞。**  
   不表示「到了一条完整消息」，更不保证「一次客户端 `write` = 一次 `OP_READ`」。所以两行业务数据出现 **三次** 可读是正常的：可能是两次发送被 TCP 切成三段，也可能其中一次 `read` 得到 0 字节（注册后立刻就绪）。  
   每次 `read` 都把字节追加进这个连接自己的 `Conn.in`，`drainLines` 碰到 `\n` 才拷到 `Conn.out` 并 `write` 回去。半包就 `compact` 留着等下一次。

4. **`echo reply` 出现在最后一次 `wait selector` 之后**  
   说明两行都已经写回客户端。主线程的 `sendLines` 凑齐 `"hello\n"` 和 `"NIO\n"` 后返回，`printDemo` 才打印。此时 `loop` 再次睡在 `select` 上——没有第四个就绪事件，它就继续等。

5. **进程随后退出**  
   `runEcho` 的 try-with-resources 关掉 server：`wakeup()` 打断 `select`，`loop` 结束。客户端 `sendLines` 返回时也会关掉自己的通道；若关得比 server 早，服务端还会再收到一次 `OP_READ` 且 `read == -1`，走 `closeKey`。你贴的日志停在打印回复，所以没画这一步。

要确认每一次可读到底拷了几个字节，在 `read()` 里打印 `n` 和 `new String(conn.in 里刚读到的字节)`。不要根据 `selectedKeys` 的次数去猜消息边界。

## 1. 事件类型

| 常量 | 含义 | 谁注册 |
| --- | --- | --- |
| `OP_ACCEPT` | 有新连接可 accept | `ServerSocketChannel` |
| `OP_CONNECT` | 非阻塞 connect 完成 | 客户端 `SocketChannel` |
| `OP_READ` | 内核接收缓冲有数据，或对端关闭 | `SocketChannel` / `DatagramChannel` |
| `OP_WRITE` | 内核发送缓冲有空间 | 需要写但上次没写完时再注册 |

**不要默认一直注册 `OP_WRITE`。** Socket 发送缓冲空闲时它几乎总是就绪，会造成 CPU 空转。只在 `write` 返回 0 / 没写完时打开，写完立刻去掉。

兴趣（interest set）可以组合：`OP_READ | OP_WRITE`。`register` 和 `interestOps` 吃的都是这组 bitmask。

## 2. 标准循环

```java
server.configureBlocking(false);
server.register(selector, SelectionKey.OP_ACCEPT);

while (running) {
    int n = selector.select();          // 没有事件时阻塞
    if (n == 0) {
        continue;                       // wakeup 或超时
    }
    Iterator<SelectionKey> it = selector.selectedKeys().iterator();
    while (it.hasNext()) {
        SelectionKey key = it.next();
        it.remove();                    // 必须手动删，否则下次还在
        if (!key.isValid()) {
            continue;
        }
        if (key.isAcceptable()) accept(key);
        if (key.isReadable())   read(key);
        if (key.isWritable())   write(key);
    }
}
```

三条铁律：

1. **`selectedKeys` 不会自动清除**，处理完必须 `iterator.remove()`。
2. 处理前检查 `key.isValid()`。`close` 或 `cancel` 后还去 `isReadable()` 会出问题。
3. `accept` 得到的 `SocketChannel` 必须设为非阻塞再 `register`。

`selectedKeys` **不是**「每次连接 / 每次读写都 insert 一条」的事件队列。Selector 里有三本账：

| 集合 | API | 里面是什么 |
| --- | --- | --- |
| 全部注册 | `selector.keys()` | 每个 Channel **一把** `SelectionKey`，`register` 时放进去，一直活到 cancel/close |
| 本次就绪 | `selector.selectedKeys()` | 上一轮 `select` 认为 **现在可以干活** 的那些 key（`keys()` 的子集） |
| 已取消 | 内部 | `cancel()` 之后，下次 `select` 时真正摘掉 |

所以：

- 新连接 `register` 时，key 进的是 `keys()`，**不是**立刻进 `selectedKeys`。要等下一次 `select` 发现它就绪。
- 同一条连接无论可读、可写还是两者都就绪，都是 **同一把 key**。差别在 `readyOps` 的位，不在「插了几行」。`if (isReadable())` 和 `if (isWritable())` 是在检查这 **一个** 对象上的两个位。
- `select` 发现某通道就绪：key 还不在 selected 集合里就加进去；已经在了就把新的就绪位 **或** 上去，不会再 new 一把 key。
- `loop` 里 `it.next()` + `it.remove()` 是从 **本轮就绪集合** 拿走，不是销毁这条连接。连接还在 `keys()` 里。下次再就绪，`select` 会把 **同一把** key 再放回 `selectedKeys`。

忘了 `remove` 的后果：这把 key 一直留在 selected 集合里，下一轮就算没有新事件也会再被处理一遍，状态机错乱，严重时空转打满 CPU。

对应 JDK `sun.nio.ch.SelectorImpl` 里的字段（你在源码里看到的那五个）：

```java
keys                = ConcurrentHashMap.newKeySet();           // 内部：全部注册
selectedKeys        = new HashSet<>();                         // 内部：本轮就绪
publicKeys          = Collections.unmodifiableSet(keys);       // selector.keys()
publicSelectedKeys  = Util.ungrowableSet(selectedKeys);        // selector.selectedKeys()
cancelledKeys       = new ArrayDeque<>();                      // cancel 后排队，下次 select 才真正摘掉
```

`selector.selectedKeys()` 返回 `publicSelectedKeys` 是刻意的：**同一份 HashSet 的受限视图，不是拷贝。** `Util.ungrowableSet` 允许 `remove` / `iterator.remove` / `clear`，`add` 直接 `UnsupportedOperationException`。这样 `loop` 能把自己处理完的 key 拿掉，但不能伪造「又就绪了一个通道」。`selector.keys()` 连 remove 都不让，防止你从外面把还活着的注册拆掉。

`cancel()` / `channel.close()` 不会立刻改 epoll。key 先丢进 `cancelledKeys`，下一次 `select` 开头的 `processDeregisterQueue()` 才从 `keys`、`selectedKeys` 和内核注册里删掉。

## 3. SelectionKey 上挂什么

`key.attachment()` 用来挂连接私有状态，例如：

```java
final class Conn {
    ByteBuffer inbound = ByteBuffer.allocate(4096);
    ByteBuffer outbound = ByteBuffer.allocate(4096);
    Decoder decoder = new LineDecoder();
}
```

不要为每个事件新建 Buffer。连接建立时分配，关闭时丢弃（或还回池）。

## 4. select 的几个变体

| 方法 | 行为 |
| --- | --- |
| `select()` | 至少有一个事件才返回，可被 `wakeup()` 打断 |
| `select(timeout)` | 最多等 timeout 毫秒 |
| `selectNow()` | 立即返回 |
| `wakeup()` | 让阻塞中的 `select` 立刻返回 |

从其他线程注册 Channel、修改 interest、关闭服务时，都要考虑 `wakeup()`，否则 Selector 线程可能一直堵在 `select()` 上看不到变更。部分 OS 上，在 `select` 阻塞期间 `register` 会阻塞到本次 select 结束，于是出现死锁：Selector 线程等事件，业务线程等 register。Netty 用事件队列 + `wakeup` 解决这个问题。本仓库的 Echo 把注册放在 Selector 线程内，避免跨线程 register。

## 5. 读和写的正确姿势

读：

```
channel.read(buf)
  n > 0   有数据，flip 后解码；半包 compact
  n == 0  非阻塞下暂无数据，忽略
  n < 0   对端关闭，关掉通道
```

写：

```
channel.write(buf)
  hasRemaining() == false  写完，取消 OP_WRITE，恢复只关心 OP_READ
  hasRemaining() == true   发送缓冲满了，注册 OP_WRITE，等下次
```

TCP 粘包 / 拆包：NIO 不会帮你按「一条消息」切。必须在应用层做：

- 定长
- 分隔符（本仓库 Echo / Chat 用 `\n`）
- 长度字段（推荐生产协议，见 `LengthPrefixedCodec` 与 [11-tcp-udp-framing.md](11-tcp-udp-framing.md)）

## 6. 水平触发

Java Selector 在 Linux 上是 **level-triggered（水平触发）**：缓冲里还有数据，下次 `select` 还会通知。所以：

- 每次就绪应尽量读到 `read` 返回 0，否则会反复被唤醒。
- 也可以只读一部分，下次再来——逻辑正确，但空转更多。

不要按边缘触发（epoll ET）的思路只读一次就走。

## 7. 空转与 100% CPU

历史 bug：JDK 在某些系统上 `select` 可能被意外 wakeup 且 `selectedKeys` 为空，循环空转把 CPU 打满。防护：

- `select` 返回 0 时不要做重逻辑。
- 对已取消的 key 及时 `channel.close()`。
- 重建 Selector（Netty 有 `nioHasWorkaround` 一类逻辑）。学习阶段遇到 100% CPU，先检查是否一直注册了 `OP_WRITE`。

## 8. 建议动手的顺序

1. 跑 `LabRunner echo`，用 `nc 127.0.0.1 9000` 再连一次，确认两个客户端互不影响。
2. 读 `NioEchoServer` 的行解码，故意发不带 `\n` 的半包，再补 `\n`。
3. 跑测试 `NioEchoServerTest`。
4. 再跑 `chat`，三个客户端互发。

## 9. 本阶段验收

- Selector 和 `loop` 线程各自干什么？为什么 Selector 不是状态机？
- 为什么必须 `remove` selected key？
- interest set 和 ready set 分别是谁写的？「改兴趣」改的是哪一个？
- 什么时候才注册 `OP_WRITE`？
- `read == 0` 和 `read == -1` 分别怎么办？
- 为什么聊天室必须自己按行切包？
