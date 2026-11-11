package group.swimrun.spike;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The exponential backoff of the Overpass client, against a scripted local server and without real waiting. */
class OverpassTest {
    private HttpServer server;
    private final AtomicInteger calls = new AtomicInteger();
    private final List<Long> waits = new ArrayList<>();

    /** A server that answers with the given statuses in turn; status 200 carries a JSON body. */
    private Overpass overpassAnswering(int... statuses) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            int status = statuses[Math.min(calls.getAndIncrement(), statuses.length - 1)];
            byte[] body = (status == 200 ? "{\"elements\":[]}" : "busy").getBytes();
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        return new Overpass("http://127.0.0.1:" + server.getAddress().getPort() + "/", waits::add);
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    @Test
    void aBusyServerIsRetriedWithADoublingWaitThenItWorks() throws Exception {
        Overpass overpass = overpassAnswering(502, 503, 200);
        assertEquals("{\"elements\":[]}", overpass.water("1,2,3,4"));
        assertEquals(List.of(1000L, 2000L), waits);
        assertEquals(3, calls.get());
    }

    @Test
    void threeBusyAnswersEndInAnError() throws Exception {
        Overpass overpass = overpassAnswering(503);
        assertThrows(IllegalStateException.class, () -> overpass.water("1,2,3,4"));
        assertEquals(List.of(1000L, 2000L), waits);
        assertEquals(3, calls.get());
    }

    @Test
    void aBadQueryIsNotRetried() throws Exception {
        Overpass overpass = overpassAnswering(400);
        assertThrows(IllegalStateException.class, () -> overpass.water("1,2,3,4"));
        assertEquals(List.of(), waits);
        assertEquals(1, calls.get());
    }

    @Test
    void anAnswerOnTheFirstTryNeedsNoWaiting() throws Exception {
        Overpass overpass = overpassAnswering(200);
        overpass.water("1,2,3,4");
        assertEquals(List.of(), waits);
    }
}
