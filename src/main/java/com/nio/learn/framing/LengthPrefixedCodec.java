package com.nio.learn.framing;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 4 字节大端 length + payload。Decoder 一次 feed 可能吐出 0..N 帧：
 * 0 帧 = 半包，N&gt;1 帧 = 粘包被拆开。
 */
public final class LengthPrefixedCodec {

    public static final int HEADER_BYTES = 4;
    public static final int DEFAULT_MAX_FRAME = 1_048_576;

    private LengthPrefixedCodec() {
    }

    public static ByteBuffer encode(byte[] payload) {
        if (payload.length > DEFAULT_MAX_FRAME) {
            throw new IllegalArgumentException("payload too large: " + payload.length);
        }
        ByteBuffer buf = ByteBuffer.allocate(HEADER_BYTES + payload.length).order(ByteOrder.BIG_ENDIAN);
        buf.putInt(payload.length).put(payload).flip();
        return buf;
    }

    public static ByteBuffer encodeUtf8(String payload) {
        return encode(payload.getBytes(StandardCharsets.UTF_8));
    }

    /** 把多帧拼进同一个 Buffer，模拟 TCP 一次 write 粘多条消息。 */
    public static ByteBuffer encodeGlued(String... payloads) {
        int total = 0;
        byte[][] bodies = new byte[payloads.length][];
        for (int i = 0; i < payloads.length; i++) {
            bodies[i] = payloads[i].getBytes(StandardCharsets.UTF_8);
            total += HEADER_BYTES + bodies[i].length;
        }
        ByteBuffer glued = ByteBuffer.allocate(total).order(ByteOrder.BIG_ENDIAN);
        for (byte[] body : bodies) {
            glued.putInt(body.length).put(body);
        }
        glued.flip();
        return glued;
    }

    public static final class Decoder {
        private final int maxFrameLength;
        private ByteBuffer acc;

        public Decoder() {
            this(DEFAULT_MAX_FRAME);
        }

        public Decoder(int maxFrameLength) {
            if (maxFrameLength <= 0) {
                throw new IllegalArgumentException("maxFrameLength");
            }
            this.maxFrameLength = maxFrameLength;
            this.acc = ByteBuffer.allocate(Math.min(256, maxFrameLength + HEADER_BYTES))
                    .order(ByteOrder.BIG_ENDIAN);
        }

        /**
         * 把新读到的字节追加进累计区，切出所有完整帧。半包留在累计区。
         */
        public List<byte[]> feed(ByteBuffer incoming) {
            append(incoming);
            acc.flip();
            List<byte[]> frames = new ArrayList<>();
            while (acc.remaining() >= HEADER_BYTES) {
                int length = acc.getInt(acc.position());
                if (length < 0 || length > maxFrameLength) {
                    throw new IllegalStateException("illegal frame length " + length);
                }
                if (acc.remaining() < HEADER_BYTES + length) {
                    break;
                }
                acc.position(acc.position() + HEADER_BYTES);
                byte[] body = new byte[length];
                acc.get(body);
                frames.add(body);
            }
            acc.compact();
            return frames;
        }

        public int buffered() {
            return acc.position();
        }

        private void append(ByteBuffer incoming) {
            while (incoming.hasRemaining()) {
                if (!acc.hasRemaining()) {
                    grow(incoming.remaining());
                }
                int n = Math.min(acc.remaining(), incoming.remaining());
                int oldLimit = incoming.limit();
                incoming.limit(incoming.position() + n);
                acc.put(incoming);
                incoming.limit(oldLimit);
            }
        }

        private void grow(int extra) {
            int needed = acc.position() + extra;
            int cap = Math.max(acc.capacity() * 2, needed);
            cap = Math.max(cap, HEADER_BYTES + Math.min(maxFrameLength, needed));
            ByteBuffer bigger = ByteBuffer.allocate(cap).order(ByteOrder.BIG_ENDIAN);
            acc.flip();
            bigger.put(acc);
            acc = bigger;
        }
    }
}
