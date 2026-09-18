package com.nio.learn.channel;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/** 三种文件复制：循环读写、transferTo、Files.copy。 */
public final class FileCopyDemo {

    public enum Strategy {
        LOOP,
        TRANSFER_TO,
        FILES_COPY
    }

    private FileCopyDemo() {
    }

    public static void copy(Path src, Path dst, Strategy strategy) throws IOException {
        switch (strategy) {
            case LOOP -> copyLoop(src, dst);
            case TRANSFER_TO -> copyTransferTo(src, dst);
            case FILES_COPY -> Files.copy(src, dst, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public static void copyLoop(Path src, Path dst) throws IOException {
        try (FileChannel in = FileChannel.open(src, StandardOpenOption.READ);
             FileChannel out = FileChannel.open(dst,
                     StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            ByteBuffer buf = ByteBuffer.allocateDirect(8 * 1024);
            while (in.read(buf) != -1) {
                buf.flip();
                while (buf.hasRemaining()) {
                    out.write(buf);
                }
                buf.clear();
            }
        }
    }

    public static void copyTransferTo(Path src, Path dst) throws IOException {
        try (FileChannel in = FileChannel.open(src, StandardOpenOption.READ);
             FileChannel out = FileChannel.open(dst,
                     StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            long position = 0;
            long size = in.size();
            while (position < size) {
                long n = in.transferTo(position, size - position, out);
                if (n <= 0) {
                    throw new IOException("transferTo made no progress at " + position);
                }
                position += n;
            }
        }
    }

    public static Path demoToTemp(Strategy strategy) throws IOException {
        Path src = Files.createTempFile("nio-copy-src-", ".txt");
        Path dst = Files.createTempFile("nio-copy-dst-", ".txt");
        Files.writeString(src, "FileChannel copy via " + strategy + "\n第二行：中文也要原样到达。\n");
        copy(src, dst, strategy);
        System.out.println(strategy + " 复制完成: " + src.getFileName() + " -> " + dst.getFileName());
        System.out.println("内容校验: " + Files.readString(dst).replace("\n", "\\n"));
        Files.deleteIfExists(src);
        Files.deleteIfExists(dst);
        return dst;
    }
}
