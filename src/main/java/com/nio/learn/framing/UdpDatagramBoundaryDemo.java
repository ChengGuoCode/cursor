package com.nio.learn.framing;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * UDP：两次 send 就是两次 receive，不会粘成一包；Buffer 过小会截断且丢弃剩余。
 */
public final class UdpDatagramBoundaryDemo {

    public record Receive(String text, int bytesInBuffer) {
    }

    private UdpDatagramBoundaryDemo() {
    }

    public static List<String> sendTwoDatagrams(String first, String second) throws IOException {
        try (DatagramChannel server = DatagramChannel.open();
             DatagramChannel client = DatagramChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            InetSocketAddress target = new InetSocketAddress("127.0.0.1",
                    ((InetSocketAddress) server.getLocalAddress()).getPort());
            client.send(ByteBuffer.wrap(first.getBytes(StandardCharsets.UTF_8)), target);
            client.send(ByteBuffer.wrap(second.getBytes(StandardCharsets.UTF_8)), target);

            List<String> got = new ArrayList<>();
            got.add(receiveUtf8(server, 256));
            got.add(receiveUtf8(server, 256));
            return got;
        }
    }

    public static Receive truncated(String message, int tinyBuffer) throws IOException {
        try (DatagramChannel server = DatagramChannel.open();
             DatagramChannel client = DatagramChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            InetSocketAddress target = new InetSocketAddress("127.0.0.1",
                    ((InetSocketAddress) server.getLocalAddress()).getPort());
            client.send(ByteBuffer.wrap(message.getBytes(StandardCharsets.UTF_8)), target);
            ByteBuffer buf = ByteBuffer.allocate(tinyBuffer);
            server.receive(buf);
            buf.flip();
            byte[] bytes = new byte[buf.remaining()];
            buf.get(bytes);
            return new Receive(new String(bytes, StandardCharsets.UTF_8), bytes.length);
        }
    }

    public static void printDemo() throws IOException {
        List<String> two = sendTwoDatagrams("one", "two");
        System.out.println("UDP 两次 send 两次 receive: " + two);

        Receive cut = truncated("0123456789", 4);
        System.out.println("UDP Buffer=4 收 10 字节报文，得到 \"" + cut.text()
                + "\"（剩余被丢弃，不会下次再读到）");
    }

    private static String receiveUtf8(DatagramChannel ch, int cap) throws IOException {
        ByteBuffer buf = ByteBuffer.allocate(cap);
        ch.receive(buf);
        buf.flip();
        byte[] bytes = new byte[buf.remaining()];
        buf.get(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
