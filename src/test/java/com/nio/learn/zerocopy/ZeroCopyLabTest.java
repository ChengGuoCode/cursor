package com.nio.learn.zerocopy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ZeroCopyLabTest {

    @TempDir
    Path tmp;

    @Test
    void transferToCopiesEntireFile() throws Exception {
        Path src = tmp.resolve("src.bin");
        Path dst = tmp.resolve("dst.bin");
        byte[] payload = new byte[32 * 1024 + 17];
        for (int i = 0; i < payload.length; i++) {
            payload[i] = (byte) (i * 31);
        }
        Files.write(src, payload);
        ZeroCopyFileTransfer.TransferResult result = ZeroCopyFileTransfer.transfer(src, dst);
        assertEquals(payload.length, result.bytes());
        assertEquals(-1, Files.mismatch(src, dst));
    }
}
