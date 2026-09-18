package com.nio.learn.buffer;

import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BufferBasicsTest {

    @Test
    void compactAfterWrite() {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.put("ABC".getBytes(StandardCharsets.UTF_8));
        buf.compact();
        buf.put("DEF".getBytes(StandardCharsets.UTF_8));
        byte[] bytes = new byte[buf.limit()];
        buf.get(bytes);
        System.out.println(new String(bytes, StandardCharsets.UTF_8));
    }

    @Test
    void orderBigEndian() {
        byte[] body = "ABCDEFG".getBytes(StandardCharsets.UTF_8);
        ByteBuffer header = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
//        header.put((byte) 'a');
        header.putInt(1000);
        header.flip();
        byte[] bytes = new byte[header.limit()];
        header.get(bytes);
        System.out.println(new String(bytes, StandardCharsets.UTF_8));
    }

    @Test
    void bufferKnowledgeVerify() {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.put((byte) 'a');
        buf.put((byte) 'b');
        byte[] bytes = new byte[2];
        buf.get(bytes);
        System.out.println(new String(bytes, StandardCharsets.UTF_8));

        // compact
        ByteBuffer compact = ByteBuffer.allocate(16);
        compact.put("12345678".getBytes(StandardCharsets.UTF_8));
        compact.flip();
        compact.get();
        compact.get();
        compact.get();
        compact.get();
        compact.get();
        compact.compact();
        compact.flip();
        byte[] bytes1 = new byte[compact.limit()];
        compact.get(bytes1);
        System.out.println(new String(bytes1, StandardCharsets.UTF_8));
    }

    @Test
    void notSupportedOperation() {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.put((byte) 'a');
        buf.put((byte) 'b');
        /*buf.flip();
        int limit = buf.limit();
        byte[] bytes = new byte[limit];
        buf.get(bytes);
        System.out.println(new String(bytes, StandardCharsets.UTF_8));*/
        if (buf.hasArray()) {
            byte[] array = buf.array();
            System.out.println(new String(array, StandardCharsets.UTF_8));

            // wrap
            ByteBuffer wrap = ByteBuffer.wrap(array);
            wrap.put((byte) 'c');
            wrap.put((byte) 'd');
            buf.flip();
            int limit = buf.limit();
            byte[] bytes = new byte[limit];
            buf.get(bytes);
            System.out.println(new String(bytes, StandardCharsets.UTF_8));
        }
    }

    @Test
    void duplicateShareContentAndIndependentPoint() {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.put((byte) 'a');
        buf.put((byte) 'b');
        buf.put((byte) 'c');
        ByteBuffer duplicate = buf.duplicate();
        duplicate.put((byte) 'd');
        duplicate.put((byte) 'e');
        duplicate.put((byte) 'f');
        duplicate.flip();
        byte[] dst = new byte[duplicate.limit()];
        duplicate.get(dst);
        System.out.println(new String(dst, StandardCharsets.UTF_8));

        buf.flip();
        byte[] bytes = new byte[buf.limit()];
        buf.get(bytes);
        System.out.println(new String(bytes, StandardCharsets.UTF_8));

        if (buf.hasArray()) {
            byte[] array = buf.array();
            System.out.println("buf array:" + new String(array, StandardCharsets.UTF_8));
        }
        if (duplicate.hasArray()) {
            byte[] array = duplicate.array();
            System.out.println("duplicate array:" + new String(array, StandardCharsets.UTF_8));
        }

        ByteBuffer readOnlyBuffer = buf.asReadOnlyBuffer();
        if (readOnlyBuffer.hasArray()) {
            byte[] array = readOnlyBuffer.array();
            System.out.println("readOnlyBuffer array:" + new String(array, StandardCharsets.UTF_8));
        }

        byte[] bytes1 = new byte[duplicate.limit()];
        buf.get(bytes1);
        System.out.println(new String(bytes1, StandardCharsets.UTF_8));
    }

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
//        assertTrue(steps.getLast().action().startsWith("clear"));
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
