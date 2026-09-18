package com.nio.learn;

import com.nio.learn.aio.AsyncFileDemo;
import com.nio.learn.buffer.BufferBasics;
import com.nio.learn.buffer.DirectVsHeapBuffer;
import com.nio.learn.buffer.ScatterGatherDemo;
import com.nio.learn.channel.FileCopyDemo;
import com.nio.learn.channel.MemoryMappedFileDemo;
import com.nio.learn.channel.UdpEchoDemo;
import com.nio.learn.nio2.PathFilesDemo;
import com.nio.learn.nio2.WatchServiceDemo;
import com.nio.learn.reactor.SingleThreadReactor;
import com.nio.learn.selector.NioChatServer;
import com.nio.learn.selector.NioEchoClient;
import com.nio.learn.selector.NioEchoServer;
import com.nio.learn.zerocopy.ZeroCopyFileTransfer;

import java.util.List;

/**
 * 统一入口。用法：java com.nio.learn.LabRunner list
 */
public final class LabRunner {

    private LabRunner() {
    }

    public static void main(String[] args) throws Exception {
        String cmd = args.length == 0 ? "list" : args[0];
        switch (cmd) {
            case "list", "help", "-h" -> printHelp();
            case "buffer" -> BufferBasics.printWalkThrough("NIO");
            case "direct" -> DirectVsHeapBuffer.printCompare("direct vs heap");
            case "scatter" -> ScatterGatherDemo.printDemo("header+body");
            case "copy" -> {
                FileCopyDemo.demoToTemp(FileCopyDemo.Strategy.LOOP);
                FileCopyDemo.demoToTemp(FileCopyDemo.Strategy.TRANSFER_TO);
                FileCopyDemo.demoToTemp(FileCopyDemo.Strategy.FILES_COPY);
            }
            case "mmap" -> MemoryMappedFileDemo.printDemo();
            case "udp" -> UdpEchoDemo.printDemo();
            case "echo" -> runEcho();
            case "chat", "chat-server" -> runChatServer();
            case "nio2" -> PathFilesDemo.printDemo();
            case "watch" -> WatchServiceDemo.printDemo();
            case "aio-file" -> AsyncFileDemo.printDemo();
            case "reactor" -> runReactor();
            case "zerocopy" -> ZeroCopyFileTransfer.printDemo();
            default -> {
                System.err.println("未知命令: " + cmd);
                printHelp();
                System.exit(1);
            }
        }
    }

    private static void runEcho() throws Exception {
        try (NioEchoServer server = NioEchoServer.start(0)) {
            System.out.println("echo server 127.0.0.1:" + server.port());
            NioEchoClient.printDemo(server.port());
        }
    }

    private static void runReactor() throws Exception {
        try (SingleThreadReactor reactor = SingleThreadReactor.start(0)) {
            System.out.println("reactor 127.0.0.1:" + reactor.port());
            List<String> replies = NioEchoClient.sendLines("127.0.0.1", reactor.port(), List.of("reactor", "works"));
            replies.forEach(r -> System.out.print("reactor reply: " + r));
        }
    }

    private static void runChatServer() throws Exception {
        try (NioChatServer server = NioChatServer.start(9001)) {
            System.out.println("另开终端：nc 127.0.0.1 " + server.port());
            System.out.println("Ctrl+C 结束。");
            Thread.sleep(Long.MAX_VALUE);
        }
    }

    private static void printHelp() {
        System.out.println("""
                Java NIO 实践入口。文档从 README.md 与 docs/ 开始。

                命令:
                  list       本帮助
                  buffer     ByteBuffer 状态机
                  direct     堆缓冲 vs 直接缓冲
                  scatter    长度头 + payload
                  copy       FileChannel 三种复制
                  mmap       内存映射
                  udp        DatagramChannel 回显
                  echo       Selector Echo（进程内客户端）
                  chat       聊天室（默认 9001，用 nc 连）
                  nio2       Path / Files
                  watch      WatchService
                  aio-file   AsynchronousFileChannel
                  reactor    单线程 Reactor Echo
                  zerocopy   transferTo
                """);
    }
}
