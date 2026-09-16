package com.nio.learn.buffer;

import com.nio.learn.BufferState;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

/** 堆缓冲与直接缓冲：都能读写 Channel，但 array() 行为不同。 */
public final class DirectVsHeapBuffer {

    public record CompareResult(
            boolean heapHasArray,
            boolean directHasArray,
            String heapRoundTrip,
            String directRoundTrip
    ) {
    }

    private DirectVsHeapBuffer() {
    }

    public static CompareResult compare(String text) {
        byte[] src = text.getBytes(StandardCharsets.UTF_8);
        ByteBuffer heap = ByteBuffer.allocate(64);
        ByteBuffer direct = ByteBuffer.allocateDirect(64);

        heap.put(src).flip();
        direct.put(src).flip();

        String fromHeap = getString(heap);
        String fromDirect = getString(direct);
        return new CompareResult(heap.hasArray(), direct.hasArray(), fromHeap, fromDirect);
    }

    public static void printCompare(String text) {
        CompareResult r = compare(text);
        ByteBuffer heap = ByteBuffer.allocate(32);
        ByteBuffer direct = ByteBuffer.allocateDirect(32);
        System.out.println("heap   hasArray=" + r.heapHasArray() + "  " + BufferState.describe(heap));
        System.out.println("direct hasArray=" + r.directHasArray() + "  " + BufferState.describe(direct));
        System.out.println("heap round-trip   = " + r.heapRoundTrip());
        System.out.println("direct round-trip = " + r.directRoundTrip());
        System.out.println("direct.array() 会抛 UnsupportedOperationException，先 hasArray() 再调用。");
    }

    private static String getString(ByteBuffer buf) {
        byte[] out = new byte[buf.remaining()];
        buf.get(out);
        return new String(out, StandardCharsets.UTF_8);
    }
}
