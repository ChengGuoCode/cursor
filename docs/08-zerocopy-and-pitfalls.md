# 08 · 零拷贝、性能与常见坑

## 1. 一次传统文件发送有几趟拷贝

读文件再写 socket 的教科书路径：

```
磁盘 → 内核页缓存 → 用户 Buffer → 内核 socket 缓冲 → 网卡
```

四次数据搬动（含 DMA 和 CPU 拷贝，细节因平台而异）。用户态来回两次最冤枉。

## 2. FileChannel.transferTo

```java
in.transferTo(position, count, socketChannel);
```

Linux 上有机会走 `sendfile`：页缓存直接到 socket 缓冲，**绕过用户空间**。这就是常说的零拷贝（仍然可能有内核内部拷贝，只是用户态不再碰数据）。

注意：

- 一次调用不一定传完，返回值是实际传输字节，要循环。
- 文件超过 2GB 时某些内核有单次上限，必须按返回值推进 position。
- Windows 实现可能退化为普通拷贝，不要把基准测试只跑在一台 Windows 笔记本上当结论。
- `transferTo` 的目标可以是 Socket 也可以是另一个 FileChannel。

`transferFrom` 方向相反。mmap + write 是另一条路径：用户空间看到的是页缓存映射，少一次拷贝，但缺页中断和 TLB 压力要自己权衡。

## 3. DirectBuffer 的「准零拷贝」

对 socket 读写，DirectBuffer 避免「堆数组 → 临时 native 缓冲」。它不是 sendfile，只是少一次拷贝。分配贵，所以要池化（Netty `PooledByteBufAllocator` 做的就是这件事）。

## 4. Selector 常见坑清单

1. **忘记 `iterator.remove()`**  
   同一 key 下次还在 selected set，重复处理，状态机错乱。

2. **一直注册 `OP_WRITE`**  
   CPU 100%。只在没写完时打开。

3. **`clear()` 掉半包**  
   一行没读完整就 `clear`，数据丢失。半包用 `compact`。

4. **在 Selector 线程做阻塞调用**  
   所有连接的心跳、读写一起停。

5. **跨线程 `register` 死锁**  
   Selector 阻塞在 `select`，另一线程阻塞在 `register`。用队列 + `wakeup`。

6. **`read == -1` 不关闭**  
   连接泄漏，文件描述符耗尽。

7. **忽略 `CancelledKeyException`**  
   对端已经关掉，本地还在写。捕获后清理 attachment。

8. **Buffer 容量当协议上限**  
   客户端发超长行把 outbound 撑满。要设最大帧长度，超限断开。

9. **`allocateDirect` 当临时变量**  
   每次请求分配堆外内存，回收滞后，RSS 上涨。

10. **`FileChannel` 注册 Selector**  
    直接抛异常。文件走阻塞线程池或 AIO。

## 5. TCP 应用层必须自己做的事

NIO 不提供消息边界。至少要有：

- 最大帧长度
- 解码失败时关闭连接（防错包打满 CPU）
- 写队列（业务一次产生多条回复）
- 空闲超时（死人连接）

本仓库为了可读性，Echo/Chat 只用 `\n` 和固定 4KB 缓冲。生产代码不要照抄容量。长度字段划界、粘包/半包与 UDP 截断见 [11-tcp-udp-framing.md](11-tcp-udp-framing.md)。

## 6. 建议动手

1. `LabRunner zerocopy`
2. 对比 `ZeroCopyFileTransfer` 里 `transferTo` 与循环拷贝的返回路径（可用 `strace -e sendfile,read,write` 在 Linux 上观察，选做）
3. 故意在 Echo 里加 `Thread.sleep(5000)` 看多客户端是否一起卡住

## 7. 本阶段验收

- `transferTo` 返回值小于 count 时怎么办？
- 列出三个会造成 CPU 100% 或 FD 泄漏的 bug。
- 为什么教学 Echo 不能直接当生产网关用？
