# 10 · 从 NIO 到 Netty

本仓库停在「能手写 Reactor」。生产环境几乎总会落到 Netty（或同样模型的框架）。这一章只做映射，不引入依赖。

## 1. 概念对照

| 你刚写过的 | Netty |
| --- | --- |
| `Selector` 循环 | `NioEventLoop` |
| boss / worker 线程 | `NioEventLoopGroup` |
| `SocketChannel` | `NioSocketChannel` |
| `ByteBuffer` | `ByteBuf`（有读写独立 index，比 flip 好用） |
| `SelectionKey.attachment` | `ChannelHandlerContext` + 自定义 Handler |
| 自己写的行解码 | `LineBasedFrameDecoder` / `LengthFieldBasedFrameDecoder` |
| 手动 `OP_WRITE` | `ChannelOutboundBuffer` 自动管写队列 |
| `wakeup` + 任务队列 | `EventLoop.execute(Runnable)` |
| DirectBuffer 池 | `PooledByteBufAllocator` |

Netty 没有推翻 NIO，它把第 8 章的坑做成了默认行为。

## 2. 为什么 ByteBuf 比 ByteBuffer 舒服

- 读指针、写指针分离，不再 `flip`。
- 引用计数，池化后必须 `release`，否则泄漏（用 leak detector）。
- `slice` / `duplicate` / `retainedDuplicate` 语义明确。
- 可以组合堆缓冲、直接缓冲、组合缓冲（`CompositeByteBuf` 替代手工 Gather）。

学完 Buffer 再看 ByteBuf 会很快；没学过 Buffer 会觉得「怎么还要 release」。

## 3. Pipeline 就是 Handler 链

```
入站：ByteBuf → 拆包 Decoder → 业务 InboundHandler
出站：业务对象 → Encoder → ByteBuf 写出
```

你在 Echo 里写的「先找 `\n`，再 echo」应当拆成 Decoder + Handler。职责分离之后才能单测业务而不起端口。本仓库 `LengthPrefixedCodec.Decoder` 就是 Decoder 这一层的裸写；Netty 的 `LengthFieldBasedFrameDecoder` 做同一件事。详见 [11-tcp-udp-framing.md](11-tcp-udp-framing.md)。

## 4. 建议的后续路径

1. 把练习 R2（主从 Reactor）写完。
2. 读 Netty 官方用户指南：EventLoop、Channel、ByteBuf、Pipeline。
3. 用 Netty 重写本仓库聊天室，对比代码量和背压（`writeAndFlush` + `ChannelFuture`）。
4. 再读 `NioEventLoop.run` 源码，你会发现就是熟悉的 `select → processSelectedKeys → runAllTasks`。

到这里，NIO 学习闭环完成：**模型 → API → 坑 → 架构 → 工业封装**。
