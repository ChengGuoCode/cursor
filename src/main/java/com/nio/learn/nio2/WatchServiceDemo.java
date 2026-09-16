package com.nio.learn.nio2;

import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** 监听目录变更。演示版会自己写一个文件，再等待事件。 */
public final class WatchServiceDemo {

    public record Event(String kind, String file) {
    }

    private WatchServiceDemo() {
    }

    public static List<Event> watchOnce(Path dir, Path fileToCreate, String content, long timeoutMs)
            throws IOException, InterruptedException {
        Files.createDirectories(dir);
        List<Event> events = new ArrayList<>();
        try (WatchService watch = FileSystems.getDefault().newWatchService()) {
            dir.register(watch,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_MODIFY,
                    StandardWatchEventKinds.ENTRY_DELETE);
            Files.writeString(fileToCreate, content);
            WatchKey key = watch.poll(timeoutMs, TimeUnit.MILLISECONDS);
            if (key == null) {
                return events;
            }
            for (WatchEvent<?> event : key.pollEvents()) {
                if (event.kind() == StandardWatchEventKinds.OVERFLOW) {
                    events.add(new Event("OVERFLOW", "*"));
                    continue;
                }
                Path name = (Path) event.context();
                events.add(new Event(event.kind().name(), name.toString()));
            }
            key.reset();
        }
        return events;
    }

    public static void printDemo() throws IOException, InterruptedException {
        Path dir = Files.createTempDirectory("nio-watch-");
        Path file = dir.resolve("created.txt");
        List<Event> events = watchOnce(dir, file, "hi\n", 3000);
        System.out.println("watching " + dir);
        if (events.isEmpty()) {
            System.out.println("timeout：某些文件系统会合并或延迟 inotify 事件，这不是逻辑错误。");
        } else {
            events.forEach(e -> System.out.println(e.kind() + " " + e.file()));
        }
        Files.deleteIfExists(file);
        Files.deleteIfExists(dir);
    }
}
