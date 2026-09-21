# Java NIO 详细学习资料、学习路径与实践

面向已经会写 Java、用过 `InputStream` / `Socket` 的同学。目标不是背 API，而是把 **BIO → NIO → NIO.2 → AIO → Reactor** 这条线走通，并能独立写出可运行的非阻塞服务。

JDK 要求：**21+**。本仓库只有 JDK 标准库，没有 Netty 依赖；Netty 放在学习路径的最后一程，作为「生产级封装」来理解。

---

## 怎么用这份资料

1. 按 [学习路径](#学习路径) 的阶段顺序读 `docs/`。
2. 每读完一章，立刻跑对应 Demo 和测试，不要只看不敲。
3. 做完 `docs/09-exercises.md` 里的练习后再进下一阶段。
4. 卡住时先对照源码注释，再回看该章「常见坑」。

```bash
mvn test                          # 跑通所有实践断言
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args=list
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args=buffer
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args=echo
```

没有 Maven 时也可以：

```bash
javac -d out $(find src/main/java -name '*.java')
java -cp out com.nio.learn.LabRunner list
```

---

## 学习路径

不要按「第几周」来排，按 **能力门槛** 往前走。前一阶段的 Demo 能自己默写，再进下一阶段。

| 阶段 | 能力门槛 | 文档 | 实践代码 | 测试 |
| --- | --- | --- | --- | --- |
| 0 心智模型 | 能讲清 BIO 阻塞在哪、NIO 为什么能一个线程管多个连接 | [01-overview.md](docs/01-overview.md) | — | — |
| 1 Buffer | 能画出 `position / limit / capacity`，独立写出 `put → flip → get → compact` | [02-buffer.md](docs/02-buffer.md) | `buffer/` | `BufferBasicsTest` |
| 2 Channel | 能用 `FileChannel` 复制文件，能解释 Scatter/Gather、mmap | [03-channel.md](docs/03-channel.md) | `channel/` | `FileChannelLabTest` |
| 2b 消息边界 | 能讲清 TCP 粘包/半包、长度字段划界、UDP 为何不粘包仍可能帧不完整 | [11-tcp-udp-framing.md](docs/11-tcp-udp-framing.md) | `framing/` | `FramingLabTest` |
| 3 Selector | 能手写非阻塞 Echo，理解 `interestOps` 与 `selectedKeys` | [04-selector.md](docs/04-selector.md) | `selector/` | `NioEchoServerTest` |
| 4 NIO.2 | 能用 `Path`/`Files`/`WatchService` 处理文件系统 | [05-nio2.md](docs/05-nio2.md) | `nio2/` | `PathFilesLabTest` |
| 5 AIO | 能对比 CompletionHandler 与 Future，知道适用场景 | [06-aio.md](docs/06-aio.md) | `aio/` | `AsyncFileLabTest` |
| 6 Reactor | 能讲单线程 Reactor 与主从 Reactor，并跑通简易实现 | [07-reactor.md](docs/07-reactor.md) | `reactor/` | `SingleThreadReactorTest` |
| 7 零拷贝与坑 | 能解释 `transferTo` / mmap，避开 Selector 常见翻车点 | [08-zerocopy-and-pitfalls.md](docs/08-zerocopy-and-pitfalls.md) | `zerocopy/` | `ZeroCopyLabTest` |
| 8 综合练习 | 独立完成练习，不看答案 | [09-exercises.md](docs/09-exercises.md) | 自己写 | 自己补 |
| 9 通向 Netty | 能把 Netty 的 EventLoop / ChannelPipeline 映射回 NIO | [10-from-nio-to-netty.md](docs/10-from-nio-to-netty.md) | — | — |

建议顺序：**文档 → Demo 的 `main` → 对应单测 → 练习题**。Selector 和 Reactor 是分水岭，前面 Buffer 不熟就不要硬冲。

---

## 仓库结构

```
docs/                          概念、图解、常见坑
src/main/java/com/nio/learn/
  LabRunner.java               统一入口：list / buffer / echo / chat / reactor ...
  buffer/                      ByteBuffer 状态机、堆外缓冲、Scatter/Gather
  channel/                     文件复制、内存映射、UDP
  framing/                     长度字段编解码、TCP 粘包、UDP 边界、finishConnect
  selector/                    非阻塞 Echo、多客户端聊天室
  nio2/                        Path / Files / WatchService
  aio/                         异步文件读写
  reactor/                     单线程 Reactor Echo
  zerocopy/                    transferTo 文件发送
src/test/java/com/nio/learn/    每个阶段的可重复断言
```

---

## 实践清单（建议全部跑一遍）

| 命令参数 | 做什么 |
| --- | --- |
| `buffer` | Buffer 状态机：put / flip / get / compact / rewind |
| `direct` | 堆缓冲 vs 直接缓冲的分配与读写 |
| `scatter` | 消息头 + 消息体的 Gather 写入 / Scatter 读出 |
| `copy` | `FileChannel` 复制文件 |
| `mmap` | 内存映射读写 |
| `udp` | `DatagramChannel` 回显 |
| `framing` | TCP 粘包/半包拆帧、UDP 报文边界、非阻塞 `finishConnect` |
| `echo` | Selector 非阻塞 Echo 服务端 + 客户端 |
| `chat` | 多客户端聊天室（一行协议） |
| `nio2` | Path / Files 列目录、读写、拷贝 |
| `watch` | 监听目录变更（需另开终端改文件） |
| `aio-file` | `AsynchronousFileChannel` 读写 |
| `reactor` | 单线程 Reactor Echo |
| `zerocopy` | `FileChannel.transferTo` 发送文件 |

聊天室示例：

```bash
# 终端 1
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args=chat-server
# 终端 2 / 3
mvn -q exec:java -Dexec.mainClass=com.nio.learn.LabRunner -Dexec.args="chat-client Alice"
```

---

## 核心心智图

```
应用代码
    │
    ▼
Buffer（数据容器：position / limit / capacity）
    │
    ▼
Channel（通向文件 / Socket 的管道）
    │
    ├─ 阻塞：FileChannel、连接后的部分操作
    └─ 非阻塞：SocketChannel + Selector 多路复用
              │
              ▼
         Reactor 循环
         select → 分发 accept/read/write → 业务处理
              │
              ▼
         生产环境通常用 Netty 封装同一套模型
```

BIO 是「一个连接一个线程，阻塞在 `read()`」。NIO 是「少量线程 + Selector 询问谁就绪」。AIO 是「内核完成后回调」。选哪个不看时髦，看连接数、延迟、操作系统和团队能否驾驭复杂度。

---

## 推荐阅读（官方优先）

1. [JSR 51: New I/O APIs](https://jcp.org/en/jsr/detail?id=51) — NIO 的出发点
2. [JSR 203: More New I/O APIs (NIO.2)](https://jcp.org/en/jsr/detail?id=203)
3. Oracle 教程：[Buffers](https://docs.oracle.com/javase/tutorial/essential/io/buffers.html)、[File I/O NIO.2](https://docs.oracle.com/javase/tutorial/essential/io/fileio.html)
4. `java.nio` / `java.nio.channels` / `java.nio.file` 的 Javadoc
5. Doug Lea《Scalable IO in Java》— Reactor 原版讲义
6. 读完本仓库后：Netty 用户指南中 EventLoop 与 ByteBuf 两章

---

## 验收标准

学完后应能不看资料做到：

- 在纸上画出 `ByteBuffer` 三次操作后的 `position/limit/capacity`
- 用 Selector 写出「多客户端、按行回显」的服务
- 说清 `clear` 和 `compact` 的区别、为何写不出去时要注册 `OP_WRITE`
- 说明 TCP 粘包 / 半包是什么，以及长度字段如何划界
- 对比 BIO / NIO / AIO 各适合什么流量模型
- 指出 DirectBuffer、空转 Selector、忘记 `remove` selected key 三类线上隐患
