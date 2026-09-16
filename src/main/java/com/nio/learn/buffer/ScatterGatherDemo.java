package com.nio.learn.buffer;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * 4 字节大端长度 + payload。Gather 写出，Scatter 读回。
 */
public final class ScatterGatherDemo {

    public record Message(int length, String payload) {
    }

    private ScatterGatherDemo() {
    }

    public static void writeTo(Path file, String payload) throws Exception {
        byte[] body = payload.getBytes(StandardCharsets.UTF_8);
        ByteBuffer header = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
        header.putInt(body.length).flip();
        ByteBuffer bodyBuf = ByteBuffer.wrap(body);
        try (FileChannel ch = FileChannel.open(file,
                StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            long written = 0;
            ByteBuffer[] parts = {header, bodyBuf};
            while (header.hasRemaining() || bodyBuf.hasRemaining()) {
                written += ch.write(parts);
            }
            if (written != 4L + body.length) {
                throw new IllegalStateException("short write: " + written);
            }
        }
    }

    public static Message readFrom(Path file) throws Exception {
        try (FileChannel ch = FileChannel.open(file, StandardOpenOption.READ)) {
            ByteBuffer header = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
            while (header.hasRemaining()) {
                if (ch.read(header) < 0) {
                    throw new IllegalStateException("unexpected EOF in header");
                }
            }
            header.flip();
            int len = header.getInt();
            if (len < 0 || len > 1_000_000) {
                throw new IllegalStateException("unreasonable length " + len);
            }
            ByteBuffer body = ByteBuffer.allocate(len);
            while (body.hasRemaining()) {
                if (ch.read(body) < 0) {
                    throw new IllegalStateException("unexpected EOF in body");
                }
            }
            body.flip();
            byte[] bytes = new byte[body.remaining()];
            body.get(bytes);
            return new Message(len, new String(bytes, StandardCharsets.UTF_8));
        }
    }

    public static Message roundTrip(String payload) throws Exception {
        Path tmp = Files.createTempFile("nio-scatter-", ".bin");
        try {
            writeTo(tmp, payload);
            return readFrom(tmp);
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    public static void printDemo(String payload) throws Exception {
        Message msg = roundTrip(payload);
        System.out.println("payload=\"" + payload + "\" header.length=" + msg.length()
                + " round-trip=\"" + msg.payload() + "\"");
    }
}
