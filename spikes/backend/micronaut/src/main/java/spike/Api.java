package spike;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.QueryValue;
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;
import java.util.Map;

@Controller("/api/v1")
@ExecuteOn(TaskExecutors.BLOCKING)
public class Api {
    private final Overpass overpass = new Overpass();

    @Get("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @Get(value = "/water", produces = "application/json")
    public String water(@QueryValue String bbox) throws Exception {
        return overpass.water(bbox);
    }
}
