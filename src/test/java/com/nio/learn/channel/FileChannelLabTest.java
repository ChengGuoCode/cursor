package com.nio.learn.channel;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileChannelLabTest {

    @Test
    void fileChannelExample() throws IOException {
        Path tmp = Files.createTempFile("nio-fileChannel-", ".txt");
        try (FileChannel write = FileChannel.open(tmp, StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING);
             FileChannel read = FileChannel.open(tmp, StandardOpenOption.READ)) {
            ByteBuffer buf = ByteBuffer.allocate(16);
            buf.put("ABCD".getBytes(StandardCharsets.UTF_8)).flip();
            int len = write.write(buf);
            System.out.println(len);
            ByteBuffer buf1 = ByteBuffer.allocate(8);
            int readLen = read.read(buf1);
            byte[] bytes = new byte[readLen];
            buf1.flip();
            buf1.get(bytes);
            System.out.println(new String(bytes, StandardCharsets.UTF_8));
        }
    }

    @TempDir
    Path tmp;

    @Test
    void copiesWithAllStrategies() throws Exception {
        Path src = tmp.resolve("src.bin");
        byte[] payload = "0123456789\n中文\n".repeat(1000).getBytes(StandardCharsets.UTF_8);
        Files.write(src, payload);
        for (FileCopyDemo.Strategy strategy : FileCopyDemo.Strategy.values()) {
            Path dst = tmp.resolve("dst-" + strategy + ".bin");
            FileCopyDemo.copy(src, dst, strategy);
            assertEquals(-1, Files.mismatch(src, dst), strategy.name());
        }
    }

    @Test
    void mmapRoundTrip() throws Exception {
        assertEquals("映射内容", MemoryMappedFileDemo.writeAndRead("映射内容"));
    }

    @Test
    void udpEcho() throws Exception {
        UdpEchoDemo.Echo echo = UdpEchoDemo.ping("ping-udp");
        assertEquals("ping-udp", echo.reply());
        assertTrue(echo.port() > 0);
    }
}
