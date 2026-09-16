package com.nio.learn.zerocopy;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * transferTo 在 Linux 上可能走 sendfile，用户态不再拷贝文件内容。
 * 一次调用不一定传完，必须按返回值推进 position。
 */
public final class ZeroCopyFileTransfer {

    public record TransferResult(long bytes, Path destination) {
    }

    private ZeroCopyFileTransfer() {
    }

    public static TransferResult transfer(Path src, Path dst) throws IOException {
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
            return new TransferResult(position, dst);
        }
    }

    public static void printDemo() throws IOException {
        Path src = Files.createTempFile("nio-zero-src-", ".bin");
        Path dst = Files.createTempFile("nio-zero-dst-", ".bin");
        try {
            Files.write(src, "zero-copy-demo-内容\n".repeat(1000).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            TransferResult result = transfer(src, dst);
            boolean same = Files.mismatch(src, dst) == -1;
            System.out.println("transferTo bytes=" + result.bytes() + " identical=" + same);
            System.out.println("Linux 上可用 strace -e sendfile,read,write 观察是否走了 sendfile。");
        } finally {
            Files.deleteIfExists(src);
            Files.deleteIfExists(dst);
        }
    }
}
