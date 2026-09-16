# 01 · 心智模型：BIO、NIO、AIO

先不要记类名。这一章只回答三个问题：数据在哪、谁在等、线程在干什么。

## 1. 一次读写实际发生了什么

以读 socket 为例：

```
网卡 → 内核 socket 缓冲区 → 用户空间字节数组 → 业务对象
```

三次拷贝是否发生、线程是否卡住，取决于 API：

| 模型 | 线程在 `read` 时 | 谁告诉你「有数据了」 | 典型 API |
| --- | --- | --- | --- |
| BIO | 阻塞，直到有数据或出错 | 内核把线程唤醒 | `InputStream.read`、`Socket.getInputStream` |
| NIO 非阻塞 | 立即返回，可能读到 0 字节 | 你去问 Selector「谁就绪」 | `SocketChannel` + `Selector` |
| AIO | 立即返回，完成时回调/Future 完成 | 内核（或用户态线程池模拟）完成后通知 | `AsynchronousSocketChannel` |

Windows 上 Java AIO 走 IOCP，Linux 上早期是线程池模拟，高版本逐步用 `io_uring` / epoll 封装。所以「AIO 一定更快」是错的，要看 JDK 与 OS。

## 2. BIO 的真实成本

```
Thread-1 ── accept() 阻塞 ──► 得到 Socket
Thread-2 ── read()   阻塞 ──► 处理连接 A
Thread-3 ── read()   阻塞 ──► 处理连接 B
...
```

- 1 万连接 ≈ 1 万线程。线程栈（默认约 1MB 量级）和上下文切换会先把机器打满，而不是 CPU 算力。
- 适合：连接少、生命周期短、逻辑简单（管理端口、内部工具、低并发 RPC）。
- 不适合：大量空闲长连接（IM、游戏、推送、网关）。

BIO 并不过时。连接数在几十到几百、业务全是同步 JDBC 时，BIO 往往更简单、更好查问题。

## 3. NIO 换了什么

NIO 的「New」已经不新了，更准确的名字是 **Non-blocking IO + 可映射缓冲 + 多路复用**。

三件套：

1. **Buffer**：数据容器。读写都经过它，不再是「直接往 byte[] 里灌」那么随意。
2. **Channel**：通向文件或套接字的双向管道。
3. **Selector**：一个线程询问「哪些 Channel 就绪了」。Linux 上通常是 epoll。

```
一个 Selector 线程
        │
        │ select()
        ▼
   ┌────┴────┬─────────┐
就绪的 accept 就绪的 read 就绪的 write
   │         │         │
 建连      读 Buffer   把 Buffer 剩余字节写出
```

关键收益：**线程数与连接数解耦**。一万个大部分空闲的连接，仍然可以几个线程处理。

关键代价：

- 必须自己管理 Buffer 状态（`flip/clear/compact`）。
- 必须处理「这次只读到一半」「这次 socket 发缓冲区满了写不出去」。
- 业务若在 Selector 线程里做了阻塞调用（同步 JDBC、`Thread.sleep`、大循环），整个端口都会卡死。

## 4. 阻塞 NIO 也存在

`FileChannel` 不能配置为非阻塞。`SocketChannel` 默认是阻塞的，必须 `configureBlocking(false)` 才能和 Selector 一起用。

所以「用了 `java.nio` 包 = 非阻塞」是错的。包名只表示 New I/O，阻塞/非阻塞是 Channel 的模式。

## 5. AIO / NIO.2 补了什么

Java 7（JSR 203）补了两块：

- **文件系统**：`Path`、`Files`、`WatchService`、目录遍历、符号链接、文件属性。这是日常开发最常用的 NIO.2。
- **真正的异步通道**：`AsynchronousSocketChannel`、`AsynchronousFileChannel`。完成时回调，不再自己 `select`。

AIO 适合「发起很多独立 I/O，完成顺序无关」的场景，例如一次性读超大文件的不同区间。对高并发网络服务器，业界主流仍是 **NIO + Reactor（Netty）**，而不是裸 AIO。原因：回调地狱、Linux 历史实现、与现有编解码生态的结合度。

## 6. 一张对照表（背这个就够）

| | BIO | NIO Selector | AIO |
| --- | --- | --- | --- |
| 编程模型 | 同步阻塞 | 同步非阻塞 + 多路复用 | 异步回调 / Future |
| 线程与连接 | 1:1 | M:N（M ≪ N） | 回调线程池 |
| 控制流 | 线性，好懂 | 事件循环，要自己拆状态机 | 回调，难调试 |
| 文件 | `FileInputStream` | `FileChannel` / mmap | `AsynchronousFileChannel` |
| 网络生产实践 | 低并发 | Netty / 自研 Reactor | 较少直接用 |

## 7. 和内核的对应关系（有助于读源码）

| Java | Linux 常见实现 |
| --- | --- |
| `Selector.select` | `epoll_wait` |
| `SocketChannel.read/write` | `read` / `write` 系统调用 |
| `FileChannel.transferTo` | `sendfile` |
| `FileChannel.map` | `mmap` |
| `AsynchronousSocketChannel`（Linux） | 历史上多为线程池 + epoll，勿假设一定是 IOCP 那种真正异步 |

你不需要会写 C。但要记住：**Java NIO 不是魔法，它是对操作系统 I/O 模型的一层对象封装。**

## 8. 本阶段验收

合上文档，口头回答：

1. 为什么 1 万个 BIO 线程会先死在内存和调度，而不是业务 CPU？
2. Selector 线程里调用阻塞 JDBC 会发生什么？
3. `FileChannel` 能不能注册到 Selector？为什么？
4. 「用了 nio 包」是否等于非阻塞？

下一章进入 Buffer。所有 Channel 读写都围着它转，状态机没画熟，后面的 Echo 服务器一定会把数据写乱。
