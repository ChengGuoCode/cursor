# 07 · Reactor：把 Selector 循环升成架构

Selector 循环写熟以后，会发现所有服务器都长一个样。这个样就是 Reactor。

Doug Lea《Scalable IO in Java》把结构拆成：

```
Reactor  :  等待事件、分发
Acceptor :  处理 OP_ACCEPT，把新连接挂到 Reactor
Handler  :  处理读写，再把业务丢给线程池（可选）
```

## 1. 单线程 Reactor

```
唯一线程：
  select
    ├ accept → 注册 OP_READ
    ├ read   → 解码 → 业务（轻量）→ 编码 → write
    └ write  → 未写完则保留 OP_WRITE
```

优点：没有线程安全问题，延迟低，适合学习、管理端口、QPS 不高的网关前置。

缺点：一个 Handler 卡住，所有连接卡住。本仓库 `SingleThreadReactor` 就是这个模型，业务只做 echo，所以安全。

## 2. 多线程 Reactor（工人池）

```
Reactor 线程：只做 I/O
业务线程池：CPU / 数据库 / 调用下游
```

读完把字节拷到业务对象后，**立刻结束 Handler**，把对象丢进线程池。写回时注意：`ByteBuffer` 和 `interestOps` 的修改要回到 Reactor 线程（队列 + `wakeup`）。

## 3. 主从 Reactor（Netty 默认形态）

```
Main Reactor（boss）
    └ OP_ACCEPT
          ↓
Sub Reactor 1（worker）── 一组连接的读写
Sub Reactor 2
Sub Reactor N
```

- boss 数量通常 1。
- worker 数量通常 CPU 核数的 1～2 倍。
- 一个连接绑定一个 worker，该连接的所有 I/O 都在同一线程，避免并发改 Buffer。

Netty 的 `NioEventLoopGroup(1)` + `NioEventLoopGroup()` 就是 boss + workers。

## 4. 和 Proactor 的区别

| | Reactor | Proactor |
| --- | --- | --- |
| 通知时机 | 「可以读/写了」 | 「已经读/写完了」 |
| 谁拷数据 | 应用在通知后自己 read/write | 内核（或框架）先完成拷贝再回调 |
| Java 对应 | Selector | AIO CompletionHandler |

Linux 上真正的 Proactor  historically 不完整，所以 Java 网络框架几乎都是 Reactor。

## 5. 本仓库实现要点

`SingleThreadReactor`：

- 一个 `Selector` + 一个循环线程。
- 每个连接一个 `ByteBuffer`，按行 echo。
- `start(port)` 返回实际端口（`0` 表示系统分配），方便测试。
- `close()` 里 `wakeup` + `join`，避免测试进程挂住。

读代码时对照循环里的 `dispatch`。把它改成「读到行以后丢进线程池再写回」，就是多线程 Reactor 的最小作业。

## 6. 本阶段验收

- 单线程 Reactor 里业务阻塞的爆炸半径。
- 为什么一个 Socket 要绑定同一个 worker 线程。
- boss 和 worker 各自注册什么事件。
- 从其他线程写 socket 为什么必须 `wakeup`。
