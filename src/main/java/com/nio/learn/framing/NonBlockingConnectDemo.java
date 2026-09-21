package com.nio.learn.framing;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;

/**
 * 非阻塞 connect 必须用 finishConnect 收尾。
 */
public final class NonBlockingConnectDemo {

    public record Outcome(boolean connectReturnedImmediately, boolean finishConnectCalled, boolean connected) {
    }

    private NonBlockingConnectDemo() {
    }

    public static Outcome connectTo(InetSocketAddress address) throws IOException {
        try (Selector selector = Selector.open();
             SocketChannel ch = SocketChannel.open()) {
            ch.configureBlocking(false);
            boolean immediate = ch.connect(address);
            if (immediate) {
                return new Outcome(true, false, ch.isConnected());
            }
            ch.register(selector, SelectionKey.OP_CONNECT);
            long deadline = System.nanoTime() + 5_000_000_000L;
            while (System.nanoTime() < deadline) {
                selector.select(200);
                Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                while (it.hasNext()) {
                    SelectionKey key = it.next();
                    it.remove();
                    if (!key.isValid() || !key.isConnectable()) {
                        continue;
                    }
                    boolean done = ch.finishConnect();
                    if (done) {
                        key.interestOps(SelectionKey.OP_READ);
                        return new Outcome(false, true, ch.isConnected());
                    }
                }
            }
            throw new IOException("finishConnect timed out, pending=" + ch.isConnectionPending());
        }
    }

    public static Outcome connectToLocalEcho() throws Exception {
        try (ServerSocketChannel server = ServerSocketChannel.open()) {
            server.bind(new InetSocketAddress("127.0.0.1", 0));
            Thread acceptor = Thread.ofVirtual().name("accept-for-connect").start(() -> {
                try (SocketChannel accepted = server.accept()) {
                    Thread.sleep(200);
                } catch (Exception ignored) {
                    // demo: just accept so handshake can complete
                }
            });
            try {
                int port = ((InetSocketAddress) server.getLocalAddress()).getPort();
                return connectTo(new InetSocketAddress("127.0.0.1", port));
            } finally {
                server.close();
                acceptor.join(1000);
            }
        }
    }

    public static void printDemo() throws Exception {
        Outcome outcome = connectToLocalEcho();
        System.out.println("non-blocking connect immediate=" + outcome.connectReturnedImmediately()
                + " finishConnectCalled=" + outcome.finishConnectCalled()
                + " connected=" + outcome.connected());
    }
}
