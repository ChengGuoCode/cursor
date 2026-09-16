# 02 · Buffer：NIO 的数据容器

Channel 读写的两端都是 Buffer。不会 Buffer，等于不会 NIO。

## 1. 三个核心指针

以容量 8 的 `ByteBuffer` 为例：

```
capacity = 8          缓冲区一共能装多少，创建后不变
limit                  第一个不可读写的位置
position               下一个要读或写的下标
mark                   可选书签，`reset()` 回到这里
```

不变量始终成立：

```
0 <= mark <= position <= limit <= capacity
```

刚 `allocate(8)` 时（写模式）：

```
pos=0  limit=8  cap=8
[ _ _ _ _ _ _ _ _ ]
  ^
  position
```

`put` 三个字节 `a b c` 后：

```
pos=3  limit=8  cap=8
[ a b c _ _ _ _ _ ]
        ^
        下一个写入点
```

## 2. 模式切换：flip / rewind / clear / compact

NIO 没有单独的「读模式对象」，全靠指针切换。

### flip：写完准备读

```
limit    = position;   // 读到刚才写到的位置为止
position = 0;
mark     = -1;
```

上面的例子 `flip()` 后：

```
pos=0  limit=3  cap=8
[ a b c _ _ _ _ _ ]
  ^     ^
  读起点 读终点
```

**最常见的 bug：写完忘记 flip，读到的是空的；读完忘记 compact/clear，下次 put 从 limit 开始直接 BufferOverflowException。**

### rewind：重新读一遍

`position = 0`，limit 不变。适合同一段数据解析两次。

### clear：丢掉「已读完」的语义，整块重新写

```
position = 0;
limit    = capacity;
```

数据其实还在数组里，只是被视为可覆盖。**clear 不是把字节填 0。**

### compact：把「还没读的」挪到开头，然后继续写

```
把 position → limit 的剩余字节拷到 0
position = 剩余长度
limit    = capacity
```

半包场景必须用 compact：这一次只解析出一条完整消息，尾巴要留着和下一次读拼起来。

## 3. 常用操作清单

| 方法 | 作用 |
| --- | --- |
| `allocate(n)` | 堆上分配，底层是 `byte[]` |
| `allocateDirect(n)` | 堆外分配，减少一次用户/内核拷贝，分配和回收更贵 |
| `wrap(byte[])` | 包住现有数组，零拷贝但共享底层 |
| `put` / `get` | 相对读写，移动 position |
| `put(i,x)` / `get(i)` | 绝对读写，不移动 position |
| `remaining()` | `limit - position` |
| `hasRemaining()` | 是否还能读写 |
| `mark()` / `reset()` | 书签 |
| `duplicate()` | 共享内容、独立指针 |
| `slice()` | 从当前 position 切一块视图 |
| `asReadOnlyBuffer()` | 只读视图 |
| `order(ByteOrder)` | 大小端，网络协议默认大端 |

`CharBuffer`、`IntBuffer` 等同理。网络和文件场景几乎总是 `ByteBuffer`。

## 4. 堆缓冲 vs 直接缓冲

| | Heap `allocate` | Direct `allocateDirect` |
| --- | --- | --- |
| 存储 | JVM 堆 `byte[]` | 堆外 native 内存 |
| GC | 普通对象 | 对象本身很小，内存由 Cleaner / `sun.misc.Unsafe` 释放 |
| 读写 socket/file | 多数实现仍要拷到 native | 可直接给系统调用 |
| 分配成本 | 低 | 高（系统调用 + 页对齐） |
| 适合 | 小消息、短生命周期 | 大块、长寿命、反复读写 Channel |

实践建议：

- 默认堆缓冲。
- 大文件、长时间复用的读写缓冲再考虑 Direct。
- DirectBuffer 要自己做池化，否则会把 native 内存打满且 GC 不着急回收。
- `ByteBuffer.allocateDirect` 没有 `array()`，调用会抛 `UnsupportedOperationException`。先 `hasArray()`。

## 5. Scatter / Gather

一个 Channel 可以对多个 Buffer 读写：

```
write(ByteBuffer[] srcs)   Gather：按顺序把多个缓冲写出，适合 header + body
read(ByteBuffer[] dsts)    Scatter：按顺序填满多个缓冲，适合定长头 + 体
```

定长协议示例：

```
[4 字节长度][N 字节 payload]
```

头用 4 字节 Buffer，体用另一个 Buffer。比自己算偏移更不容易错。变长体仍要先读头，再按长度分配第二个 Buffer。

## 6. 和 Stream 的心智差异

BIO：

```java
int n = in.read(bytes);   // 最多 bytes.length，n 可能小于 length
```

NIO：

```java
int n = channel.read(buf); // 最多 buf.remaining()，n 可能是 0（非阻塞）或 -1（对端关闭）
```

差别：

- 非阻塞下 `n == 0` 是正常的，表示此刻没数据，不是错误。
- 读到 `-1` 必须关掉 Channel，并取消 SelectionKey。
- 写同理：`channel.write(buf)` 可能只写出一部分，剩余字节要等 `OP_WRITE`。

## 7. 建议动手的顺序

1. 跑 `LabRunner buffer`，对照打印出的 pos/lim/cap。
2. 改测试：在 `flip` 前尝试 `get`，观察现象。
3. 用一张纸画 `compact`：buffer 里有 8 字节，读了 5 字节，compact 后指针在哪。
4. 跑 `LabRunner scatter` 看头体分离。

对应代码：

- `src/main/java/com/nio/learn/buffer/BufferBasics.java`
- `DirectVsHeapBuffer.java`
- `ScatterGatherDemo.java`
- 测试：`BufferBasicsTest`

## 8. 本阶段验收

- 不看文档画出 `put(3)` → `flip` → `get(1)` → `compact` 的指针。
- 解释为什么 Echo 服务器每次 `read` 之后通常要 `flip`，写完后若还有半包要用 `compact` 而不是 `clear`。
- 说出一种不该用 DirectBuffer 的场景。
