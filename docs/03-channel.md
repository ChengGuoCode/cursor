# 03 · Channel：通向文件和网络的管道

Buffer 是箱子，Channel 是路。路的种类决定你能不能非阻塞、能不能注册到 Selector。

## 1. 家族关系

```
Channel
 ├─ ReadableByteChannel / WritableByteChannel / ByteChannel
 ├─ ScatteringByteChannel / GatheringByteChannel
 ├─ InterruptibleChannel          可被线程中断关闭
 ├─ NetworkChannel                bind / getLocalAddress
 ├─ FileChannel                   文件，只能阻塞
 ├─ SocketChannel                 TCP 客户端 / 已接受连接
 ├─ ServerSocketChannel           TCP 监听
 ├─ DatagramChannel               UDP
 ├─ Pipe.SourceChannel / SinkChannel
 └─ Asynchronous*                 NIO.2 异步通道，见第 6 章
```

共同特点：

- 双向的比 Stream 自然（同一个 `SocketChannel` 又能读又能写）。
- 可关闭，实现 `AutoCloseable`。
- 大多数传输单位是 `ByteBuffer`。

## 2. FileChannel

获取方式：

```java
try (FileChannel in = FileChannel.open(path, READ);
     FileChannel out = FileChannel.open(path2, CREATE, WRITE, TRUNCATE_EXISTING)) {
    in.transferTo(0, in.size(), out);
}
```

或从旧 API：`new FileInputStream(file).getChannel()`。

能力：

| 能力 | 方法 | 备注 |
| --- | --- | --- |
| 定位读写 | `position()` / `read(buf, pos)` | 随机访问 |
| 强制刷盘 | `force(metaData)` | 持久化语义 |
| 锁 | `lock` / `tryLock` | 进程间，不是线程锁 |
| 零拷贝传输 | `transferTo` / `transferFrom` | 能走 sendfile 时走内核 |
| 内存映射 | `map(mode, pos, size)` | `MappedByteBuffer` |

限制：

- **不能** `configureBlocking(false)`，**不能** 注册 Selector。
- `map` 的大小受地址空间限制，32 位 JVM 要小心；映射后文件长度变化要重新 map。
- `MappedByteBuffer` 的显式卸载没有公开稳定 API，依赖 GC / `Unsafe.invokeCleaner`（不要在业务里随便调用）。

`transferTo` 细节见 [08-zerocopy-and-pitfalls.md](08-zerocopy-and-pitfalls.md)。

## 3. SocketChannel / ServerSocketChannel

TCP 服务端最小骨架（阻塞模式，先建立直觉）：

```java
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(9000));
SocketChannel client = server.accept();   // 阻塞直到有连接
ByteBuffer buf = ByteBuffer.allocate(1024);
int n = client.read(buf);                 // 阻塞直到有数据
```

改成非阻塞后：

```java
server.configureBlocking(false);
SocketChannel client = server.accept();   // 没有连接时返回 null，不是阻塞
client.configureBlocking(false);
int n = client.read(buf);                 // 没数据返回 0
```

`connect` 也分两步：

```java
channel.configureBlocking(false);
channel.connect(address);       // 立即返回
// 等 OP_CONNECT 就绪后
channel.finishConnect();
```

忘记 `finishConnect()` 是客户端常见坑。

## 4. DatagramChannel

UDP 无连接。可以 `bind` 后 `receive`/`send`，也可以 `connect` 到对端后用 `read`/`write`（仍然是 UDP，只是锁定了对端地址）。

特点：

- 一次 `receive` 一条报文，不会像 TCP 那样粘包。
- 仍然可能丢包、乱序、重复。
- 可以注册 Selector（`OP_READ`）。

## 5. Scatter / Gather 在 Channel 上

`FileChannel` 和 Socket 通道都实现了 Scattering/Gathering。把协议头和体拆成两个 Buffer，写出时一次 `write(new ByteBuffer[]{header, body})`。见 `ScatterGatherDemo`。

## 6. 中断与关闭

`InterruptibleChannel`：当另一个线程 `interrupt` 正在阻塞在 Channel 上的线程时，通道会被关闭并抛 `ClosedByInterruptException`。这和普通 `InputStream` 被中断后的行为不同，写线程池任务时要小心。

关闭顺序建议：

1. 输出 shutdown（TCP：`socket.shutdownOutput()`）——若协议需要半关闭。
2. `channel.close()`。
3. 从 Selector 上取消 key（`close` 通常会自动 cancel，但仍要在循环里处理取消后的 key）。

## 7. 建议动手的顺序

1. `LabRunner copy`：对比 `transferTo` 与循环 `read/write`。
2. `LabRunner mmap`：改文件后看映射是否立即可见（共享模式）。
3. `LabRunner udp`：本机发一条报文并回显。
4. 读 `FileCopyDemo` 里三种复制路径的注释。

## 8. 本阶段验收

- `FileChannel` 为何不能进 Selector？
- 非阻塞 `accept()` 返回 `null` 时该做什么？
- `connect` 之后为什么还要 `finishConnect`？
- UDP 为什么没有 TCP 那种「粘包」问题，却仍要处理不完整业务帧（如果你自己在应用层拼消息）？
