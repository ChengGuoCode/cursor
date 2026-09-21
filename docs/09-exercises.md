# 09 · 练习题

先独立做。参考实现都在 `src/main/java` 里，但练习要求你 **新建自己的类**，不要复制粘贴改名字。

做完用 `mvn test` 的风格自己补测试；仓库测试覆盖的是 Demo，不是你的作业。

## 基础（阶段 1–2）

**B1. 指针默写**  
容量 6 的 `ByteBuffer`，依次：`put` 四个字节、`flip`、`get` 两次、`compact`、再 `put` 一个字节。写下每一步的 `position/limit/capacity`。

**B2. 切片视图**  
`wrap("ABCDEFGH".getBytes(UTF_8))` 后 `position=2; limit=6; slice()`。对 slice `put(0, (byte) 'x')`，原 buffer 的第几个字节变了？写测试证明。

**B3. 三种文件复制**  
用循环 `read/write`、`transferTo`、`Files.copy` 各写一个方法，复制 8MB 随机文件，断言内容一致。记录耗时，但不把耗时当正确性标准。

**B4. 定长头协议**  
4 字节大端长度 + payload。用 Gather 写、Scatter 读。payload 为 0 和恰好填满缓冲两种都要测。对照 `LengthPrefixedCodec`：一次 feed 里粘两帧、以及半个 header，都要能拆对。

## 网络（阶段 3）

**N1. 行 Echo 自己写**  
不看 `NioEchoServer`，写一个只支持 `\n` 的非阻塞 Echo。测试：两个客户端交错发送半包，最终各自收到完整行。

**N2. 写阻塞**  
把服务端 outbound 缓冲改得很小，客户端一次发 64KB。观察你是否正确注册/取消 `OP_WRITE`。若 CPU 打满，回头看第 4、8 章。

**N3. 聊天室广播**  
在本仓库 `NioChatServer` 之上增加：`/me 名字` 改名，`/who` 列出在线用户。注意广播时某个客户端写不完，不能卡住别人。

**N4. 空闲踢出**  
30 秒没有 `OP_READ` 的连接断开。提示：`select(timeout)` + 遍历 keys 看上次活跃时间，不要为每个连接再开线程。

## NIO.2 / AIO（阶段 4–5）

**F1. 目录统计**  
给定根目录，输出普通文件数、总字节、按扩展名聚合。必须正确关闭 `Files.walk`。

**F2. 配置热加载**  
用 WatchService 监视 `config/` 目录，文件修改后重新解析。处理 OVERFLOW（降级为重读全目录）。

**F3. 异步分片读**  
把一个文件按 1MB 切片，用 `AsynchronousFileChannel` + `CompletionHandler` 并行读（限制并发度为 4），拼回后校验 CRC32。

## Reactor（阶段 6）

**R1. 业务线程池**  
改 `SingleThreadReactor`：解码后把字符串丢进 `ExecutorService`，处理完再投递回 Reactor 线程写出。证明：业务里 `sleep(200)` 时，其他连接的 echo 仍然及时。

**R2. 主从拆分**  
一个 boss Selector 只 accept，把 Channel 轮询注册到 2 个 worker。每个 worker 自己循环。这是理解 Netty 的关键作业。

## 设计题（写短文即可）

**D1.** 内网文件下载服务，单文件 4GB，连接数 50，瓶颈在磁盘。选 BIO / NIO / AIO / `transferTo` 的哪种组合，为什么？

**D2.** 百万空闲 TCP 长连接的推送网关，每条消息 < 100 字节。画出线程模型，标出 Buffer 分配策略（堆 / 直接 / 池化）。

**D3.** 列出把本仓库 Echo 直接暴露到公网会出的五个问题。
