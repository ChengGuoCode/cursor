package com.nio.learn.channel;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.DatagramChannel;
import java.nio.charset.StandardCharsets;

/** 本进程内 UDP 回显：发送一条报文并接收。 */
public final class UdpEchoDemo {

    public record Echo(String request, String reply, int port) {
    }

    private UdpEchoDemo() {
    }

    public static Echo ping(String message) throws IOException {
        try (DatagramChannel server = DatagramChannel.open();
             DatagramChannel client = DatagramChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            int port = ((InetSocketAddress) server.getLocalAddress()).getPort();

            ByteBuffer payload = ByteBuffer.wrap(message.getBytes(StandardCharsets.UTF_8));
            client.send(payload, new InetSocketAddress("127.0.0.1", port));

            ByteBuffer incoming = ByteBuffer.allocate(1024);
            SocketAddress from = server.receive(incoming);
            incoming.flip();
            byte[] bytes = new byte[incoming.remaining()];
            incoming.get(bytes);
            ByteBuffer outgoing = ByteBuffer.wrap(bytes);
            server.send(outgoing, from);

            ByteBuffer replyBuf = ByteBuffer.allocate(1024);
            client.receive(replyBuf);
            replyBuf.flip();
            byte[] replyBytes = new byte[replyBuf.remaining()];
            replyBuf.get(replyBytes);
            return new Echo(message, new String(replyBytes, StandardCharsets.UTF_8), port);
        }
    }

    public static void printDemo() throws IOException {
        Echo echo = ping("udp-nio");
        System.out.println("UDP :" + echo.port() + "  " + echo.request() + " -> " + echo.reply());
    }
}
