package group.swimrun.spike;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class Api {
    private final Overpass overpass = new Overpass();

    @GetMapping("/api/v1/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping(value = "/api/v1/water", produces = "application/json")
    public String water(@RequestParam String bbox) throws Exception {
        return overpass.water(bbox);
    }
}
