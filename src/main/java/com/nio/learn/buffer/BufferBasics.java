package com.nio.learn.buffer;

import com.nio.learn.BufferState;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Buffer 状态机演示：put → flip → get → compact → rewind。
 * 对应文档 docs/02-buffer.md。
 */
public final class BufferBasics {

    public record Step(String action, String state, String decoded) {
    }

    private BufferBasics() {
    }

    public static List<Step> walkThrough(String text) {
        ByteBuffer buf = ByteBuffer.allocate(16);
        List<Step> steps = new ArrayList<>();
        steps.add(step("allocate(16)", buf));

        buf.put(text.getBytes(StandardCharsets.UTF_8));
        steps.add(step("put(\"" + text + "\")", buf));

        buf.flip();
        steps.add(step("flip()  写完准备读", buf));

        byte first = buf.get();
        steps.add(step("get() 读到 0x" + String.format("%02x", first), buf));

        buf.mark();
        steps.add(step("mark()", buf));

        buf.get();
        steps.add(step("get() 再读一字节", buf));

        buf.reset();
        steps.add(step("reset() 回到 mark", buf));

        buf.compact();
        steps.add(step("compact() 未读数据挪到开头，进入写模式", buf));

        buf.flip();
        steps.add(step("flip() 再次准备读剩余数据", buf));

        byte[] rest = new byte[buf.remaining()];
        buf.get(rest);
        steps.add(step("get(rest) 读完剩余 \"" + new String(rest, StandardCharsets.UTF_8) + "\"", buf));

        buf.clear();
        steps.add(step("clear() 只重置指针，底层字节仍在", buf));
        return steps;
    }

    /** compact 前后指针，供测试断言。 */
    public static int[] compactUnread(byte[] data, int alreadyRead) {
        ByteBuffer buf = ByteBuffer.allocate(data.length);
        buf.put(data).flip();
        buf.position(alreadyRead);
        buf.compact();
        return new int[] {buf.position(), buf.limit(), buf.capacity()};
    }

    public static void printWalkThrough(String text) {
        for (Step step : walkThrough(text)) {
            System.out.println(step.action());
            System.out.println("  " + step.state());
            System.out.println("  bytes=" + step.decoded());
        }
    }

    private static Step step(String action, ByteBuffer buf) {
        ByteBuffer view = buf.duplicate();
        view.limit(Math.max(view.limit(), view.position()));
        view.position(0);
        int readableLimit = buf.limit();
        byte[] snapshot = new byte[readableLimit];
        view.get(snapshot);
        String decoded = new String(snapshot, StandardCharsets.ISO_8859_1)
                .replace('\u0000', '·');
        return new Step(action, BufferState.describe(buf), decoded);
    }
}
