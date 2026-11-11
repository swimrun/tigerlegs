package spike;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/** The Overpass water query with exponential backoff (1 s, 2 s) on a busy server, framework independent. */
public final class Overpass {
    private static final Set<Integer> RETRYABLE = Set.of(429, 502, 503, 504);
    /** How the service waits between attempts; replaced in the tests so they do not sleep. */
    public interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }

    private final HttpClient client = HttpClient.newHttpClient();
    private final String url;
    private final Sleeper sleeper;

    public Overpass() {
        this(System.getenv().getOrDefault("OVERPASS_URL", "https://overpass-api.de/api/interpreter"), Thread::sleep);
    }

    public Overpass(String url, Sleeper sleeper) {
        this.url = url;
        this.sleeper = sleeper;
    }

    public String water(String bbox) throws Exception {
        String query = "[out:json][timeout:25];(way[\"natural\"=\"water\"](" + bbox + ");relation[\"natural\"=\"water\"]("
                + bbox + ");way[\"waterway\"=\"riverbank\"](" + bbox + "););out geom;";
        String body = "data=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
        long wait = 1000;
        Exception last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20))
                        .header("content-type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) return response.body();
                last = new IllegalStateException("Overpass returned status " + response.statusCode());
                if (!RETRYABLE.contains(response.statusCode())) throw (IllegalStateException) last;
            } catch (IOException e) {
                last = e;
            }
            if (attempt < 3) {
                sleeper.sleep(wait);
                wait *= 2;
            }
        }
        throw last;
    }
}
