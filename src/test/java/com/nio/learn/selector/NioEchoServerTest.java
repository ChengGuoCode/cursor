package com.nio.learn.selector;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NioEchoServerTest {

    @Test
    void echoesCompleteLines() throws Exception {
        try (NioEchoServer server = NioEchoServer.start(0)) {
            List<String> replies = NioEchoClient.sendLines("127.0.0.1", server.port(),
                    List.of("hello", "second"));
            assertEquals(List.of("hello\n", "second\n"), replies);
        }
    }

    @Test
    void assemblesHalfPackets() throws Exception {
        try (NioEchoServer server = NioEchoServer.start(0);
             Socket socket = new Socket("127.0.0.1", server.port())) {
            socket.setSoTimeout(3000);
            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();
            out.write("hel".getBytes(StandardCharsets.UTF_8));
            out.flush();
            Thread.sleep(80);
            out.write("lo\n".getBytes(StandardCharsets.UTF_8));
            out.flush();
            byte[] buf = new byte[16];
            int n = in.read(buf);
            assertEquals("hello\n", new String(buf, 0, n, StandardCharsets.UTF_8));
        }
    }

    @Test
    void twoClientsAreIndependent() throws Exception {
        try (NioEchoServer server = NioEchoServer.start(0);
             Socket a = new Socket("127.0.0.1", server.port());
             Socket b = new Socket("127.0.0.1", server.port())) {
            a.setSoTimeout(3000);
            b.setSoTimeout(3000);
            a.getOutputStream().write("aaa\n".getBytes(StandardCharsets.UTF_8));
            b.getOutputStream().write("bbb\n".getBytes(StandardCharsets.UTF_8));
            a.getOutputStream().flush();
            b.getOutputStream().flush();
            assertEquals("aaa\n", readLine(a.getInputStream()));
            assertEquals("bbb\n", readLine(b.getInputStream()));
        }
    }

    @Test
    void chatBroadcastsToPeer() throws Exception {
        try (NioChatServer server = NioChatServer.start(0);
             Socket a = new Socket("127.0.0.1", server.port());
             Socket b = new Socket("127.0.0.1", server.port())) {
            a.setSoTimeout(3000);
            b.setSoTimeout(3000);
            Thread.sleep(150);
            drainQuietly(a.getInputStream());
            drainQuietly(b.getInputStream());
            a.getOutputStream().write("ping\n".getBytes(StandardCharsets.UTF_8));
            a.getOutputStream().flush();
            String found = null;
            long deadline = System.currentTimeMillis() + 3000;
            while (System.currentTimeMillis() < deadline) {
                String line = readLine(b.getInputStream());
                if (line.contains("ping")) {
                    found = line;
                    break;
                }
            }
            assertTrue(found != null && found.contains("ping"), "broadcast missing ping, last=" + found);
        }
    }

    private static String readLine(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder();
        int c;
        while ((c = in.read()) != -1) {
            sb.append((char) c);
            if (c == '\n') {
                return sb.toString();
            }
        }
        return sb.toString();
    }

    private static void drainQuietly(InputStream in) {
        try {
            while (in.available() > 0) {
                in.read();
            }
        } catch (Exception ignored) {
            // best-effort
        }
    }
}
