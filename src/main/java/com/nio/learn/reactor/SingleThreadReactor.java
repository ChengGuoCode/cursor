package com.nio.learn.reactor;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.CancelledKeyException;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 单线程 Reactor：一个 Selector 线程完成 accept / decode / echo / write。
 * 业务一旦阻塞，所有连接都会停。练习 R1 要求把业务丢进线程池。
 */
public final class SingleThreadReactor implements AutoCloseable {

    private final int bindPort;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private Selector selector;
    private ServerSocketChannel server;
    private Thread loopThread;
    private volatile int actualPort = -1;

    public SingleThreadReactor(int bindPort) {
        this.bindPort = bindPort;
    }

    public static SingleThreadReactor start(int port) throws IOException {
        SingleThreadReactor reactor = new SingleThreadReactor(port);
        reactor.start();
        return reactor;
    }

    public void start() throws IOException {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        selector = Selector.open();
        server = ServerSocketChannel.open();
        server.configureBlocking(false);
        server.bind(new InetSocketAddress("127.0.0.1", bindPort));
        actualPort = ((InetSocketAddress) server.getLocalAddress()).getPort();
        server.register(selector, SelectionKey.OP_ACCEPT);
        loopThread = new Thread(this::loop, "reactor-" + actualPort);
        loopThread.setDaemon(true);
        loopThread.start();
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
                        dispatch(key);
                    } catch (CancelledKeyException | IOException ex) {
                        closeKey(key);
                    }
                }
            }
        } catch (IOException ex) {
            running.set(false);
        }
    }

    private void dispatch(SelectionKey key) throws IOException {
        if (key.isAcceptable()) {
            SocketChannel client = server.accept();
            if (client == null) {
                return;
            }
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ, new Handler());
            return;
        }
        Handler handler = (Handler) key.attachment();
        if (key.isReadable()) {
            handler.read(key);
        }
        if (key.isValid() && key.isWritable()) {
            handler.flush(key);
        }
    }

    private static void closeKey(SelectionKey key) {
        try {
            key.channel().close();
        } catch (IOException ignored) {
            // closing
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

    static final class Handler {
        final ByteBuffer in = ByteBuffer.allocate(4096);
        final ByteBuffer out = ByteBuffer.allocate(4096);

        void read(SelectionKey key) throws IOException {
            SocketChannel ch = (SocketChannel) key.channel();
            int n = ch.read(in);
            if (n < 0) {
                ch.close();
                return;
            }
            in.flip();
            int start = in.position();
            for (int i = start; i < in.limit(); i++) {
                if (in.get(i) != '\n') {
                    continue;
                }
                int len = i - start + 1;
                if (out.remaining() < len) {
                    ch.close();
                    return;
                }
                ByteBuffer line = in.duplicate();
                line.position(start).limit(i + 1);
                out.put(line);
                start = i + 1;
            }
            in.position(start);
            in.compact();
            flush(key);
        }

        void flush(SelectionKey key) throws IOException {
            SocketChannel ch = (SocketChannel) key.channel();
            out.flip();
            ch.write(out);
            if (out.hasRemaining()) {
                out.compact();
                key.interestOps(SelectionKey.OP_READ | SelectionKey.OP_WRITE);
            } else {
                out.clear();
                key.interestOps(SelectionKey.OP_READ);
            }
        }
    }
}
