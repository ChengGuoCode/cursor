package com.nio.learn.channel;

import java.io.IOException;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/** 内存映射：把文件当成 ByteBuffer 读写。 */
public final class MemoryMappedFileDemo {

    private MemoryMappedFileDemo() {
    }

    public static String writeAndRead(String text) throws IOException {
        Path file = Files.createTempFile("nio-mmap-", ".dat");
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        try (FileChannel ch = FileChannel.open(file,
                StandardOpenOption.READ, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            ch.truncate(bytes.length);
            MappedByteBuffer map = ch.map(FileChannel.MapMode.READ_WRITE, 0, bytes.length);
            map.put(bytes);
            map.force();
            map.position(0);
            byte[] out = new byte[bytes.length];
            map.get(out);
            return new String(out, StandardCharsets.UTF_8);
        } finally {
            Files.deleteIfExists(file);
        }
    }

    public static void printDemo() throws IOException {
        String text = "mmap hello 内存映射";
        System.out.println("round-trip=" + writeAndRead(text));
        System.out.println("MappedByteBuffer 是堆外映射，没有公开的稳定 unmap API，生命周期交给 GC。");
    }
}
