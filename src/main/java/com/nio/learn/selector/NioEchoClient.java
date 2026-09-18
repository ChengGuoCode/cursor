package com.nio.learn.selector;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** 阻塞模式客户端，用来驱动 Echo / Reactor 演示与测试。 */
public final class NioEchoClient {

    private NioEchoClient() {
    }

    public static List<String> sendLines(String host, int port, List<String> lines) throws IOException {
        try (SocketChannel ch = SocketChannel.open(new InetSocketAddress(host, port))) {
            ch.configureBlocking(true);
            ByteBuffer out = ByteBuffer.allocate(4096);
            for (String line : lines) {
                out.clear();
                out.put(line.getBytes(StandardCharsets.UTF_8));
                if (line.isEmpty() || line.charAt(line.length() - 1) != '\n') {
                    out.put((byte) '\n');
                }
                out.flip();
                while (out.hasRemaining()) {
                    ch.write(out);
                }
            }
            List<String> replies = new ArrayList<>();
            ByteBuffer in = ByteBuffer.allocate(4096);
            StringBuilder acc = new StringBuilder();
            while (replies.size() < lines.size()) {
                in.clear();
                int n = ch.read(in);
                if (n < 0) {
                    break;
                }
                in.flip();
                while (in.hasRemaining()) {
                    char c = (char) (in.get() & 0xff);
                    acc.append(c);
                    if (c == '\n') {
                        replies.add(acc.toString());
                        acc.setLength(0);
                    }
                }
            }
            return replies;
        }
    }

    public static void printDemo(int port) throws IOException {
        List<String> replies = sendLines("127.0.0.1", port, List.of("hello", "NIO"));
        replies.forEach(r -> System.out.print("echo reply: " + r));
    }
}
