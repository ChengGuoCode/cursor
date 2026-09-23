package com.nio.learn.framing;

import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.nio.channels.SelectableChannel;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FramingLabTest {

    @Test
    void fileChannelIsNotSelectable() {
        assertFalse(SelectableChannel.class.isAssignableFrom(FileChannel.class),
                "FileChannel does not extend SelectableChannel, so it cannot register a Selector");
    }

    @Test
    void nonBlockingAcceptReturnsNullWhenIdle() throws Exception {
        try (ServerSocketChannel server = ServerSocketChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            server.configureBlocking(false);
            assertNull(server.accept(), "no pending connection must yield null, not block");
        }
    }

    @Test
    void acceptedSocketStartsInBlockingMode() throws Exception {
        try (ServerSocketChannel server = ServerSocketChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            server.configureBlocking(false);
            int port = ((InetSocketAddress) server.getLocalAddress()).getPort();
            try (SocketChannel incoming = SocketChannel.open(new InetSocketAddress("127.0.0.1", port))) {
                SocketChannel accepted = null;
                for (int i = 0; i < 50 && accepted == null; i++) {
                    accepted = server.accept();
                    if (accepted == null) {
                        Thread.sleep(10);
                    }
                }
                assertNotNull(accepted);
                try {
                    assertTrue(accepted.isBlocking(), "accept() always returns a blocking channel");
                    incoming.finishConnect();
                } finally {
                    accepted.close();
                }
            }
        }
    }

    @Test
    void decoderSplitsStickyPackets() {
        LengthPrefixedCodec.Decoder decoder = new LengthPrefixedCodec.Decoder();
        List<byte[]> frames = decoder.feed(LengthPrefixedCodec.encodeGlued("alpha", "beta"));
        assertEquals(List.of("alpha", "beta"), utf8(frames));
        assertEquals(0, decoder.buffered());
    }

    @Test
    void decoderWaitsForHalfHeaderThenHalfBody() {
        LengthPrefixedCodec.Decoder decoder = new LengthPrefixedCodec.Decoder();
        ByteBuffer whole = LengthPrefixedCodec.encodeUtf8("hello");
        assertTrue(whole.remaining() > 6);

        ByteBuffer headerPart = whole.duplicate();
        headerPart.limit(2);
        assertTrue(decoder.feed(headerPart).isEmpty());
        assertEquals(2, decoder.buffered());

        ByteBuffer untilFive = whole.duplicate();
        untilFive.position(2).limit(5);
        assertTrue(decoder.feed(untilFive).isEmpty());

        ByteBuffer rest = whole.duplicate();
        rest.position(5);
        assertEquals(List.of("hello"), utf8(decoder.feed(rest)));
        assertEquals(0, decoder.buffered());
    }

    @Test
    void decoderRejectsOversizeLength() {
        LengthPrefixedCodec.Decoder decoder = new LengthPrefixedCodec.Decoder(8);
        ByteBuffer bad = ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN);
        bad.putInt(9).flip();
        assertThrows(IllegalStateException.class, () -> decoder.feed(bad));
    }

    @Test
    void tcpGlueWriteStillYieldsTwoMessages() throws Exception {
        TcpStickyPacketDemo.Result result = TcpStickyPacketDemo.glueTwoMessages("alpha", "beta");
        assertEquals(List.of("alpha", "beta"), result.frames());
        assertEquals(1, result.clientWrites());
        assertTrue(result.serverReads() >= 1);
    }

    @Test
    void tcpSmallReadsAssembleOneFrame() throws Exception {
        ByteBuffer payload = LengthPrefixedCodec.encodeUtf8("abcdef");
        TcpStickyPacketDemo.Result result = TcpStickyPacketDemo.roundTrip(payload, 1, 3);
        assertEquals(List.of("abcdef"), result.frames());
        assertTrue(result.serverReads() >= 2, "3-byte reads must take multiple turns, reads=" + result.serverReads());
    }

    @Test
    void udpTwoSendsAreTwoReceives() throws Exception {
        assertEquals(List.of("one", "two"), UdpDatagramBoundaryDemo.sendTwoDatagrams("one", "two"));
    }

    @Test
    void udpTinyBufferTruncatesAndDropsRemainder() throws Exception {
        UdpDatagramBoundaryDemo.Receive cut = UdpDatagramBoundaryDemo.truncated("0123456789", 4);
        assertEquals("0123", cut.text());
        assertEquals(4, cut.bytesInBuffer());
    }

    private static List<String> utf8(List<byte[]> frames) {
        return frames.stream().map(b -> new String(b, StandardCharsets.UTF_8)).toList();
    }
}
