package com.nio.learn.nio2;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PathFilesLabTest {

    @Test
    void summarizesCreatedTree() throws Exception {
        Path root = PathFilesDemo.demoTree();
        PathFilesDemo.TreeSummary summary = PathFilesDemo.summarize(root);
        assertEquals(3, summary.files());
        assertTrue(summary.bytes() > 0);
        assertEquals(List.of("notes/hello.bak", "notes/hello.txt", "readme.md"), summary.names());
        assertEquals("hello nio2", Files.readString(root.resolve("notes/hello.txt")).strip());
    }

    @Test
    void watchServiceSeesCreate() throws Exception {
        Path dir = Files.createTempDirectory("watch-test-");
        Path file = dir.resolve("a.txt");
        List<WatchServiceDemo.Event> events = WatchServiceDemo.watchOnce(dir, file, "x\n", 4000);
        assertFalse(events.isEmpty(), "expected at least one CREATE/MODIFY from inotify");
        assertTrue(events.stream().anyMatch(e -> e.file().equals("a.txt")
                || "OVERFLOW".equals(e.kind())));
    }
}
