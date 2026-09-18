package com.nio.learn.selector;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** 发送若干行并读取一段时间的回复，便于自动化演示。 */
public final class NioChatClient {

    private NioChatClient() {
    }

    public static List<String> sendAndCollect(String host, int port, String name, List<String> lines, int waitMs)
            throws IOException, InterruptedException {
        try (SocketChannel ch = SocketChannel.open(new InetSocketAddress(host, port))) {
            ch.configureBlocking(true);
            ch.socket().setSoTimeout(waitMs);
            for (String line : lines) {
                ByteBuffer out = ByteBuffer.wrap((line + "\n").getBytes(StandardCharsets.UTF_8));
                while (out.hasRemaining()) {
                    ch.write(out);
                }
            }
            ByteBuffer in = ByteBuffer.allocate(4096);
            StringBuilder acc = new StringBuilder();
            List<String> replies = new ArrayList<>();
            long deadline = System.currentTimeMillis() + waitMs;
            while (System.currentTimeMillis() < deadline) {
                try {
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
                            replies.add(acc.toString().stripTrailing());
                            acc.setLength(0);
                        }
                    }
                } catch (java.net.SocketTimeoutException timeout) {
                    break;
                }
            }
            return replies;
        }
    }
}
