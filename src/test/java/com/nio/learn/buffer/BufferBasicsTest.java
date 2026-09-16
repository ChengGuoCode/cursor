package com.nio.learn.buffer;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BufferBasicsTest {

    @Test
    void compactKeepsUnreadBytesAtFront() {
        byte[] data = "ABCDEFGH".getBytes(StandardCharsets.US_ASCII);
        int[] posLimCap = BufferBasics.compactUnread(data, 5);
        assertArrayEquals(new int[] {3, 8, 8}, posLimCap);
    }

    @Test
    void walkThroughEndsWithClear() {
        var steps = BufferBasics.walkThrough("NIO");
        assertTrue(steps.size() >= 8);
        assertTrue(steps.get(0).action().startsWith("allocate"));
        assertTrue(steps.get(2).action().startsWith("flip"));
        assertTrue(steps.getLast().action().startsWith("clear"));
    }

    @Test
    void sliceSharesBackingArray() {
        ByteBuffer buf = ByteBuffer.wrap("ABCDEFGH".getBytes(StandardCharsets.US_ASCII));
        buf.position(2).limit(6);
        ByteBuffer slice = buf.slice();
        slice.put(0, (byte) 'x');
        assertEquals('x', (char) buf.get(2));
        assertEquals("ABxDEFGH", new String(buf.array(), StandardCharsets.US_ASCII));
    }

    @Test
    void flipThenGetWithoutRemainingThrows() {
        ByteBuffer buf = ByteBuffer.allocate(4);
        buf.put((byte) 1).flip();
        buf.get();
        assertFalse(buf.hasRemaining());
        assertThrows(java.nio.BufferUnderflowException.class, buf::get);
    }

    @Test
    void directBufferHasNoArray() {
        DirectVsHeapBuffer.CompareResult r = DirectVsHeapBuffer.compare("abc");
        assertTrue(r.heapHasArray());
        assertFalse(r.directHasArray());
        assertEquals("abc", r.heapRoundTrip());
        assertEquals("abc", r.directRoundTrip());
    }

    @Test
    void scatterGatherRoundTrip() throws Exception {
        ScatterGatherDemo.Message empty = ScatterGatherDemo.roundTrip("");
        assertEquals(0, empty.length());
        assertEquals("", empty.payload());

        ScatterGatherDemo.Message cn = ScatterGatherDemo.roundTrip("你好NIO");
        assertEquals("你好NIO".getBytes(StandardCharsets.UTF_8).length, cn.length());
        assertEquals("你好NIO", cn.payload());
    }
}
