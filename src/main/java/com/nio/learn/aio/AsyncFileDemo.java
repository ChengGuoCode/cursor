package com.nio.learn.aio;

import java.nio.ByteBuffer;
import java.nio.channels.AsynchronousFileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.concurrent.Future;

/** AsynchronousFileChannel：每次读写都要带 position，没有通道游标。 */
public final class AsyncFileDemo {

    private AsyncFileDemo() {
    }

    public static String writeThenRead(String text) throws Exception {
        Path file = Files.createTempFile("nio-aio-", ".txt");
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        try (AsynchronousFileChannel ch = AsynchronousFileChannel.open(file,
                StandardOpenOption.READ, StandardOpenOption.WRITE)) {
            ByteBuffer out = ByteBuffer.wrap(bytes);
            Future<Integer> write = ch.write(out, 0);
            int written = write.get();
            if (written != bytes.length) {
                throw new IllegalStateException("short async write " + written);
            }
            ByteBuffer in = ByteBuffer.allocate(bytes.length);
            Future<Integer> read = ch.read(in, 0);
            int n = read.get();
            in.flip();
            byte[] got = new byte[in.remaining()];
            in.get(got);
            if (n != bytes.length) {
                throw new IllegalStateException("short async read " + n);
            }
            return new String(got, StandardCharsets.UTF_8);
        } finally {
            Files.deleteIfExists(file);
        }
    }

    public static void printDemo() throws Exception {
        String text = "AIO file channel 你好";
        System.out.println("round-trip=" + writeThenRead(text));
        System.out.println("练习：把 Future.get 改成 CompletionHandler 链，见 docs/09-exercises.md F3。");
    }
}
