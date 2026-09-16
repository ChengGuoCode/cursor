package com.nio.learn.reactor;

import com.nio.learn.selector.NioEchoClient;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SingleThreadReactorTest {

    @Test
    void echoesThroughReactorLoop() throws Exception {
        try (SingleThreadReactor reactor = SingleThreadReactor.start(0)) {
            List<String> replies = NioEchoClient.sendLines(
                    "127.0.0.1", reactor.port(), List.of("alpha", "beta"));
            assertEquals(List.of("alpha\n", "beta\n"), replies);
        }
    }
}
