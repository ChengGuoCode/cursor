package com.nio.learn.aio;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AsyncFileLabTest {

    @Test
    void asyncFileRoundTrip() throws Exception {
        assertEquals("异步文件读写", AsyncFileDemo.writeThenRead("异步文件读写"));
    }
}
