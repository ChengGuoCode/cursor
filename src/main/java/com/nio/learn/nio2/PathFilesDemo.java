package com.nio.learn.nio2;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.List;
import java.util.stream.Stream;

/** Path / Files 日常操作：创建、读写、拷贝、遍历。 */
public final class PathFilesDemo {

    public record TreeSummary(int files, long bytes, List<String> names) {
    }

    private PathFilesDemo() {
    }

    public static Path demoTree() throws IOException {
        Path root = Files.createTempDirectory("nio2-demo-");
        Path notes = root.resolve("notes");
        Files.createDirectories(notes);
        Files.writeString(notes.resolve("hello.txt"), "hello nio2\n", StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        Files.writeString(root.resolve("readme.md"), "# demo\n", StandardCharsets.UTF_8);
        Files.copy(notes.resolve("hello.txt"), notes.resolve("hello.bak"),
                StandardCopyOption.REPLACE_EXISTING);
        return root;
    }

    public static TreeSummary summarize(Path root) throws IOException {
        int[] files = {0};
        long[] bytes = {0};
        List<String> names = new java.util.ArrayList<>();
        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile).forEach(p -> {
                files[0]++;
                try {
                    bytes[0] += Files.size(p);
                    names.add(root.relativize(p).toString().replace('\\', '/'));
                } catch (IOException e) {
                    throw new IllegalStateException(e);
                }
            });
        }
        names.sort(String::compareTo);
        return new TreeSummary(files[0], bytes[0], names);
    }

    public static void printDemo() throws IOException {
        Path root = demoTree();
        try {
            TreeSummary summary = summarize(root);
            System.out.println("root=" + root);
            System.out.println("files=" + summary.files() + " bytes=" + summary.bytes());
            summary.names().forEach(n -> System.out.println("  " + n));
            Path hello = root.resolve("notes").resolve("hello.txt");
            System.out.println("hello.txt=" + Files.readString(hello).strip());
        } finally {
            try (Stream<Path> walk = Files.walk(root)) {
                walk.sorted((a, b) -> b.getNameCount() - a.getNameCount()).forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                        // best-effort cleanup
                    }
                });
            }
        }
    }
}
