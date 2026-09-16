package com.nio.learn.selector;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.CancelledKeyException;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 按行广播的聊天室。每个连接有独立 inbound/outbound。
 * 某个客户端写缓冲满时只给它加 OP_WRITE，不影响其他人。
 */
public final class NioChatServer implements AutoCloseable {

    private final int bindPort;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicInteger clientSeq = new AtomicInteger();
    private final Map<SocketChannel, Conn> clients = new LinkedHashMap<>();

    private Selector selector;
    private ServerSocketChannel server;
    private Thread loopThread;
    private volatile int actualPort = -1;

    public NioChatServer(int bindPort) {
        this.bindPort = bindPort;
    }

    public static NioChatServer start(int port) throws IOException, InterruptedException {
        NioChatServer server = new NioChatServer(port);
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
        CountDownLatch ready = new CountDownLatch(1);
        loopThread = new Thread(this::loop, "nio-chat-" + actualPort);
        loopThread.setDaemon(true);
        loopThread.start();
        ready.countDown();
        if (!ready.await(5, TimeUnit.SECONDS)) {
            throw new IOException("chat server did not start");
        }
        System.out.println("chat server listening on 127.0.0.1:" + actualPort);
    }

    public int port() {
        return actualPort;
    }

    public int clientCount() {
        synchronized (clients) {
            return clients.size();
        }
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
                            flush(key);
                        }
                    } catch (CancelledKeyException | IOException ex) {
                        closeKey(key);
                    }
                }
            }
        } catch (IOException ex) {
            running.set(false);
        }
    }

    private void accept() throws IOException {
        SocketChannel client = server.accept();
        if (client == null) {
            return;
        }
        client.configureBlocking(false);
        Conn conn = new Conn("user-" + clientSeq.incrementAndGet());
        client.register(selector, SelectionKey.OP_READ, conn);
        synchronized (clients) {
            clients.put(client, conn);
        }
        enqueue(conn, "* " + conn.name + " joined\n");
        flush(client.keyFor(selector));
        broadcast("* " + conn.name + " is online, total=" + clientCount() + "\n", client);
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
        int start = conn.in.position();
        for (int i = start; i < conn.in.limit(); i++) {
            if (conn.in.get(i) != '\n') {
                continue;
            }
            ByteBuffer lineBuf = conn.in.duplicate();
            lineBuf.position(start).limit(i); // 不含换行
            byte[] raw = new byte[lineBuf.remaining()];
            lineBuf.get(raw);
            String line = new String(raw, StandardCharsets.UTF_8).trim();
            start = i + 1;
            if (!line.isEmpty()) {
                broadcast("[" + conn.name + "] " + line + "\n", null);
            }
        }
        conn.in.position(start);
        conn.in.compact();
    }

    private void broadcast(String text, SocketChannel exclude) {
        List<Map.Entry<SocketChannel, Conn>> snapshot;
        synchronized (clients) {
            snapshot = new ArrayList<>(clients.entrySet());
        }
        for (Map.Entry<SocketChannel, Conn> e : snapshot) {
            if (e.getKey() == exclude) {
                continue;
            }
            enqueue(e.getValue(), text);
            SelectionKey key = e.getKey().keyFor(selector);
            if (key != null && key.isValid()) {
                try {
                    flush(key);
                } catch (IOException ex) {
                    closeKey(key);
                }
            }
        }
    }

    private static void enqueue(Conn conn, String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (conn.out.remaining() < bytes.length) {
            return; // 教学实现：丢弃而不是撑爆缓冲；练习 N3 要求改成写队列
        }
        conn.out.put(bytes);
    }

    private static void flush(SelectionKey key) throws IOException {
        if (key == null || !key.isValid()) {
            return;
        }
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

    private void closeKey(SelectionKey key) {
        SocketChannel ch = (SocketChannel) key.channel();
        Conn conn;
        synchronized (clients) {
            conn = clients.remove(ch);
        }
        try {
            ch.close();
        } catch (IOException ignored) {
            // closing
        }
        if (conn != null) {
            broadcast("* " + conn.name + " left\n", null);
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
        synchronized (clients) {
            for (SocketChannel ch : clients.keySet()) {
                try {
                    ch.close();
                } catch (IOException ignored) {
                    // shutdown
                }
            }
            clients.clear();
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
        final String name;
        final ByteBuffer in = ByteBuffer.allocate(4096);
        final ByteBuffer out = ByteBuffer.allocate(8192);

        Conn(String name) {
            this.name = name;
        }
    }
}
