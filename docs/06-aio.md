# 06 · AIO：异步通道

AIO 指 `java.nio.channels.Asynchronous*`。编程模型从「我来问谁就绪」变成「完成了叫我」。

## 1. 两类完成方式

**Future：**

```java
Future<Integer> f = channel.read(buf, position);
int n = f.get();          // 仍可能在业务线程阻塞
```

适合偶尔异步、后面还是想写线性代码。若处处 `get()`，就退化成 BIO，还多了线程切换。

**CompletionHandler：**

```java
channel.read(buf, position, attachment, new CompletionHandler<>() {
    public void completed(Integer n, A att) { /* 下一个动作 */ }
    public void failed(Throwable e, A att) { /* 关闭、打日志 */ }
});
```

真正的异步链：读完 → 解码 → 写；写完 → 再读。状态必须进 `attachment` 或成员字段，不要靠调用栈。

## 2. 异步文件

`AsynchronousFileChannel.open(path, READ, WRITE)`：

- 每次读写都要给 **position**（没有通道内部游标）。
- 并发读同一个通道可以，写同一区间要自己同步。
- 适合大文件分片、同时读多个区间。

本仓库 `AsyncFileDemo` 演示写完再读回校验。

## 3. 异步 Socket

`AsynchronousServerSocketChannel` / `AsynchronousSocketChannel`：

```java
server.accept(null, new CompletionHandler<AsynchronousSocketChannel, Void>() {
    public void completed(AsynchronousSocketChannel ch, Void att) {
        server.accept(null, this);     // 必须再次 accept，否则只接一个
        readLoop(ch);
    }
    ...
});
```

漏掉「再次 accept」只会处理一个连接。这是 AIO 服务器第一坑。

## 4. 线程组

`AsynchronousChannelGroup.withThreadPool(executor)` 控制回调跑在哪。默认 group 的线程数有限。回调里做重计算或阻塞 I/O，会饿死其他完成事件——和 Selector 线程里阻塞是同一类错误。

## 5. 什么时候用，什么时候不用

用：

- 大文件随机区间读写。
- 已经有完成回调风格的代码，不想引入 Netty。
- Windows 上希望吃到 IOCP。

不用 / 慎用：

- 要做生产级 TCP 协议栈（编解码、空闲检测、拆包）——用 Netty。
- Linux 上假设「AIO = 一定比 epoll 快」。
- 团队不熟悉回调状态机。

## 6. 建议动手

1. `LabRunner aio-file`
2. 阅读 `AsyncFileDemo`，把 `Future.get` 改成 `CompletionHandler` 链（练习题里有）

## 7. 本阶段验收

- 为什么每次 `AsynchronousFileChannel.read` 都要传 position？
- accept 的 CompletionHandler 里为什么要再次 `accept`？
- 回调线程里打同步锁、调 JDBC 的后果？
