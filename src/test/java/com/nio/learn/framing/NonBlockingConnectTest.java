package com.nio.learn.framing;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class NonBlockingConnectTest {

    @Test
    void finishConnectCompletesHandshakeWhenConnectDidNot() throws Exception {
        NonBlockingConnectDemo.Outcome outcome = NonBlockingConnectDemo.connectToLocalEcho();
        assertTrue(outcome.connected());
        assertTrue(outcome.connectReturnedImmediately() || outcome.finishConnectCalled(),
                "either connect() finished immediately or finishConnect() must run: " + outcome);
    }
}
