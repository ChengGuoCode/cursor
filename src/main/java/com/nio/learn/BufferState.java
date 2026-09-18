package com.nio.learn;

import java.nio.ByteBuffer;

/** 把 Buffer 三个指针打成一行，方便对照文档画图。 */
public final class BufferState {
    private BufferState() {
    }

    public static String describe(ByteBuffer buf) {
        return "pos=%d lim=%d cap=%d remaining=%d".formatted(
                buf.position(), buf.limit(), buf.capacity(), buf.remaining());
    }

    public static String hex(ByteBuffer buf) {
        ByteBuffer view = buf.duplicate();
        StringBuilder sb = new StringBuilder();
        while (view.hasRemaining()) {
            sb.append(String.format("%02x", view.get()));
            if (view.hasRemaining()) {
                sb.append(' ');
            }
        }
        return sb.toString();
    }
}
