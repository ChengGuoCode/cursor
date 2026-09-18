package com.nio.learn.selector;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.CancelledKeyException;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 非阻塞行回显服务器：读到 '\\n' 就把该行原样写回。
 * 半包留在 inbound 里 compact，写不完时才注册 OP_WRITE。
 */
public final class NioEchoServer implements AutoCloseable {

    private final int bindPort;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final CountDownLatch bound = new CountDownLatch(1);

    private Selector selector;
    private ServerSocketChannel server;
    private Thread loopThread;
    private volatile int actualPort = -1;
    private volatile Exception startError;

    public NioEchoServer(int bindPort) {
        this.bindPort = bindPort;
    }

    public static NioEchoServer start(int port) throws IOException, InterruptedException {
        NioEchoServer server = new NioEchoServer(port);
        server.start();
        return server;
    }

    public void start() throws IOException, InterruptedException {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        selector = Selector.open();
        server = ServerSocketChannel.open();
        server.configureBlocking(false);
        server.bind(new InetSocketAddress("127.0.0.1", bindPort));
        actualPort = ((InetSocketAddress) server.getLocalAddress()).getPort();
        server.register(selector, SelectionKey.OP_ACCEPT);
        loopThread = new Thread(this::loop, "nio-echo-" + actualPort);
        loopThread.setDaemon(true);
        loopThread.start();
        bound.countDown();
        if (!bound.await(5, TimeUnit.SECONDS)) {
            throw new IOException("echo server did not bind");
        }
        if (startError != null) {
            throw new IOException("echo server failed", startError);
        }
    }

    public int port() {
        return actualPort;
    }

    private void loop() {
        try {
            while (running.get()) {
                selector.select(200);
                Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                while (it.hasNext()) {
                    SelectionKey key = it.next();
                    it.remove();
                    if (!key.isValid()) {
                        continue;
                    }
                    try {
                        if (key.isAcceptable()) {
                            accept();
                        }
                        if (key.isValid() && key.isReadable()) {
                            read(key);
                        }
                        if (key.isValid() && key.isWritable()) {
                            write(key);
                        }
                    } catch (CancelledKeyException | IOException ex) {
                        closeKey(key);
                    }
                }
            }
        } catch (IOException ex) {
            startError = ex;
        } finally {
            running.set(false);
        }
    }

    private void accept() throws IOException {
        SocketChannel client = server.accept();
        if (client == null) {
            return;
        }
        client.configureBlocking(false);
        client.register(selector, SelectionKey.OP_READ, new Conn());
    }

    private void read(SelectionKey key) throws IOException {
        SocketChannel ch = (SocketChannel) key.channel();
        Conn conn = (Conn) key.attachment();
        int n = ch.read(conn.in);
        if (n < 0) {
            closeKey(key);
            return;
        }
        conn.in.flip();
        drainLines(conn);
        conn.in.compact();
        flush(key);
    }

    private static void drainLines(Conn conn) {
        ByteBuffer in = conn.in;
        int start = in.position();
        for (int i = start; i < in.limit(); i++) {
            if (in.get(i) != '\n') {
                continue;
            }
            int len = i - start + 1;
            if (conn.out.remaining() < len) {
                throw new IllegalStateException("outbound buffer full, increase size or add a write queue");
            }
            ByteBuffer line = in.duplicate();
            line.position(start).limit(i + 1);
            conn.out.put(line);
            start = i + 1;
        }
        in.position(start);
    }

    private void write(SelectionKey key) throws IOException {
        flush(key);
    }

    private static void flush(SelectionKey key) throws IOException {
        SocketChannel ch = (SocketChannel) key.channel();
        Conn conn = (Conn) key.attachment();
        conn.out.flip();
        ch.write(conn.out);
        if (conn.out.hasRemaining()) {
            conn.out.compact();
            key.interestOps(SelectionKey.OP_READ | SelectionKey.OP_WRITE);
        } else {
            conn.out.clear();
            key.interestOps(SelectionKey.OP_READ);
        }
    }

    private static void closeKey(SelectionKey key) {
        try {
            key.channel().close();
        } catch (IOException ignored) {
            // closing a broken channel
        }
    }

    @Override
    public void close() {
        running.set(false);
        if (selector != null) {
            selector.wakeup();
        }
        try {
            if (loopThread != null) {
                loopThread.join(2000);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
        try {
            if (server != null) {
                server.close();
            }
        } catch (IOException ignored) {
            // shutdown
        }
        try {
            if (selector != null) {
                selector.close();
            }
        } catch (IOException ignored) {
            // shutdown
        }
    }

    static final class Conn {
        final ByteBuffer in = ByteBuffer.allocate(4096);
        final ByteBuffer out = ByteBuffer.allocate(4096);
    }
}
