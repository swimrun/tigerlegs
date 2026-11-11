# Back-end spike

The same small service on four candidates, in a container, to measure what [ADR-0014](../../docs/adr/0014-back-end-technology.md) can only estimate (criterion C3: image size, idle memory, start time) and to see what each stack feels like (issue #65).
The baseline is the Deno API of the project (117 MB image, 21.7 MiB idle, measured on 2026-11-10).

## The service

- `GET /api/v1/health` answers `{"status":"ok"}`.
- `GET /api/v1/water?bbox=south,west,north,east` asks Overpass for the water in the bounding box, the same query as `fetchWater` in the browser, and passes the JSON through. A busy server (429, 502, 503, 504) or a network error is retried after 1 s and 2 s (exponential backoff), then the request fails with a 502.
- The Overpass server comes from `OVERPASS_URL`; the measurement uses the local server of [local-overpass.md](../../docs/local-overpass.md).

Phase 2 adds a PostgreSQL read through each candidate's data layer, with a Flyway migration and a PostGIS column.

## Candidates

| Directory    | Stack                                              | Notes                                                                                           |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `spring-boot`  | Java 25, Spring Boot 4.1 (Spring MVC)            | `Dockerfile` is the plain JVM, `Dockerfile.leyden` adds the Project Leyden AOT cache             |
| `micronaut`    | Java 25, Micronaut 5.2                           | Plain JVM; a native image variant follows                                                        |
| `node`         | TypeScript on Node.js 24, built-in `http`        | No framework and no dependencies, so it shows the floor of Node.js                               |
| `aspnet-core`  | C# on .NET 10, ASP.NET Core minimal API          | Framework-dependent publish on the ASP.NET runtime image                                         |

The Overpass client is written once in plain Java (`Overpass.java`, the JDK HttpClient) for both Java candidates, so the numbers compare the frameworks and not their HTTP clients.

## Measure

```sh
docker compose --profile overpass up -d overpass      # the local Overpass server, see local-overpass.md
./measure.sh spring-boot
./measure.sh spring-boot Dockerfile.leyden
./measure.sh micronaut
./measure.sh node
./measure.sh aspnet-core
```

`measure.sh` builds the image, starts a container, and prints one line: image size, build time, time until `/api/v1/health` answers, idle memory after 20 s, and memory after 100 water requests.
Run it on an otherwise quiet machine; the numbers are for comparing the candidates on the same machine, not absolute.

## Record the results

`./record.sh` runs the backoff tests of every stack and the measurements of every variant and stores the output, with the date and the machine, in `results/`.
ADR-0014 points at these files; commit a new pair when the numbers are measured again.
