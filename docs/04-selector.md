# 04 · Selector：一个线程如何管一万个连接

Selector 是 NIO 网络编程的心脏。模型是：**注册兴趣 → 阻塞/超时等待就绪 → 逐个处理 → 改兴趣 → 再 wait**。

## 1. 事件类型

| 常量 | 含义 | 谁注册 |
| --- | --- | --- |
| `OP_ACCEPT` | 有新连接可 accept | `ServerSocketChannel` |
| `OP_CONNECT` | 非阻塞 connect 完成 | 客户端 `SocketChannel` |
| `OP_READ` | 内核接收缓冲有数据，或对端关闭 | `SocketChannel` / `DatagramChannel` |
| `OP_WRITE` | 内核发送缓冲有空间 | 需要写但上次没写完时再注册 |

**不要默认一直注册 `OP_WRITE`。** Socket 发送缓冲空闲时它几乎总是就绪，会造成 CPU 空转。只在 `write` 返回 0 / 没写完时打开，写完立刻去掉。

兴趣可以组合：`OP_READ | OP_WRITE`。

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
- 长度字段（推荐生产协议）

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

- 为什么必须 `remove` selected key？
- 什么时候才注册 `OP_WRITE`？
- `read == 0` 和 `read == -1` 分别怎么办？
- 为什么聊天室必须自己按行切包？
