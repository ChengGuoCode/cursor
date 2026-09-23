package com.nio.learn.framing;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * 客户端把多条消息粘在一次 TCP write 里发出去；服务端用长度字段拆开。
 */
public final class TcpStickyPacketDemo {

    public record Result(List<String> frames, int clientWrites, int serverReads) {
    }

    private TcpStickyPacketDemo() {
    }

    public static Result glueTwoMessages(String first, String second) throws Exception {
        return roundTrip(LengthPrefixedCodec.encodeGlued(first, second), 2, 8);
    }

    /**
     * @param payload        已经编码的字节流（可含多帧）
     * @param expectedFrames 期望拆出的业务消息数
     * @param serverReadSize 服务端每次 read 的 Buffer 容量，故意读小以制造半包
     */
    public static Result roundTrip(ByteBuffer payload, int expectedFrames, int serverReadSize)
            throws Exception {
        CompletableFuture<ReadOutcome> done = new CompletableFuture<>();
        try (ServerSocketChannel server = ServerSocketChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            int port = ((InetSocketAddress) server.getLocalAddress()).getPort();
            Thread acceptor = Thread.ofVirtual().name("tcp-framing-server").start(() -> {
                try (SocketChannel client = server.accept()) {
                    done.complete(readFrames(client, expectedFrames, serverReadSize));
                } catch (Exception ex) {
                    done.completeExceptionally(ex);
                }
            });
            int writes;
            try (SocketChannel ch = SocketChannel.open(new InetSocketAddress("127.0.0.1", port))) {
                writes = writeFully(ch, payload.duplicate());
            }
            try {
                ReadOutcome outcome = done.get(5, TimeUnit.SECONDS);
                return new Result(outcome.frames, writes, outcome.reads);
            } finally {
                acceptor.join(1000);
            }
        }
    }

    public static void printDemo() throws Exception {
        Result glued = glueTwoMessages("alpha", "beta");
        System.out.println("TCP 一次 write 粘了两帧，对端拆出: " + glued.frames()
                + "  (clientWrites=" + glued.clientWrites()
                + ", serverReads=" + glued.serverReads() + ")");

        ByteBuffer whole = LengthPrefixedCodec.encodeUtf8("hello-half");
        ByteBuffer first = whole.duplicate();
        first.limit(3);
        ByteBuffer rest = whole.duplicate();
        rest.position(3);
        ByteBuffer split = ByteBuffer.allocate(whole.remaining());
        split.put(first).put(rest).flip();
        Result half = roundTrip(split, 1, 3);
        System.out.println("TCP 半包（服务端每次最多读 3 字节）拼出: " + half.frames()
                + "  serverReads=" + half.serverReads());
    }

    static ReadOutcome readFrames(SocketChannel ch, int expectedFrames, int readSize) throws IOException {
        LengthPrefixedCodec.Decoder decoder = new LengthPrefixedCodec.Decoder();
        ByteBuffer buf = ByteBuffer.allocate(readSize);
        List<String> frames = new ArrayList<>();
        int reads = 0;
        while (frames.size() < expectedFrames) {
            buf.clear();
            int n = ch.read(buf);
            if (n < 0) {
                break;
            }
            reads++;
            buf.flip();
            for (byte[] body : decoder.feed(buf)) {
                frames.add(new String(body, StandardCharsets.UTF_8));
            }
        }
        return new ReadOutcome(frames, reads);
    }

    static int writeFully(SocketChannel ch, ByteBuffer buf) throws IOException {
        int writes = 0;
        while (buf.hasRemaining()) {
            int n = ch.write(buf);
            if (n > 0) {
                writes++;
            }
        }
        return writes;
    }

    record ReadOutcome(List<String> frames, int reads) {
    }
}
