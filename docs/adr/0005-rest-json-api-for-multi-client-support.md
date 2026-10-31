# 5. REST/JSON API for Multi-Client Support

Date: 2026-06-15

## Status

Accepted

## Context

The Deno backend (ADR-0004) currently serves as an API proxy for
landscape feature lookups. As the project evolves, multiple client
types may consume this API:

1. **Web app** (current) — browser-based SPA
2. **Mobile native app** (future) — iOS/Android for on-the-go
   analysis
3. **Garmin Connect IQ app** (future) — watch-based data field or
   widget on Fenix 8, Forerunner, etc.

Garmin Connect IQ supports HTTP requests via `makeWebRequest()` in
Monkey C. This requires HTTPS and returns JSON responses. The Fenix
8 and newer watches with LTE/Wi-Fi can make these requests
directly; older models proxy through the paired phone via Garmin
Connect Mobile. This means a REST/JSON API is directly consumable
from a Garmin watch app.

We need to decide on the API style for the backend to ensure it can
serve all these clients without modification.

## Quality Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Client compatibility | High | Must work from browsers, mobile apps, and Garmin Connect IQ |
| Simplicity | High | Minimal learning curve; standard tooling in every language |
| Payload size | Medium | Important for watch apps with limited bandwidth |
| Discoverability | Medium | API should be self-documenting or easily documented |
| Extensibility | Medium | Easy to add new endpoints without breaking clients |
| Caching friendliness | Medium | HTTP caching headers work naturally |
| Offline resilience | Low | Clients may cache responses locally |

## Options

### Option A: REST/JSON API (chosen)

Standard RESTful HTTP endpoints returning JSON responses.

```
GET  /api/terrain/lookup?lat=45.123&lon=5.456
POST /api/terrain/batch     (body: { coordinates: [...] })
GET  /api/health
```

#### Pros

- Universal client support: browsers (fetch), mobile (URLSession,
  OkHttp), Garmin (makeWebRequest), curl, Postman
- JSON is native to JavaScript/TypeScript — zero serialization
  overhead in Deno
- HTTP caching (ETag, Cache-Control) works out of the box
- Garmin Connect IQ `makeWebRequest()` natively parses JSON
  responses
- Easy to version (`/api/v1/...`) for future breaking changes
- OpenAPI/Swagger documentation can be generated
- Standard HTTP status codes for error handling

#### Cons

- Slightly more verbose than binary protocols
- No built-in streaming (fine for our small payloads)

### Option B: GraphQL

Single endpoint with query language.

#### Pros

- Flexible queries, clients request only needed fields
- Strong schema/type system
- Single endpoint simplifies routing

#### Cons

- Garmin Connect IQ has no GraphQL client; would need raw POST
  with JSON body (awkward but possible)
- Overkill for 2–3 simple endpoints
- Adds schema definition overhead
- Harder to cache (POST requests, variable queries)
- Larger client libraries needed on mobile

### Option C: gRPC / Protocol Buffers

Binary RPC protocol.

#### Pros

- Compact payloads, efficient serialization
- Strong typing via .proto files
- Bi-directional streaming

#### Cons

- Not supported by Garmin Connect IQ (no protobuf on Monkey C)
- Not supported by browsers without grpc-web proxy
- Heavyweight for 2–3 simple endpoints
- Requires code generation step

## Decision

**Option A: REST/JSON API.**

The backend SHALL expose a RESTful JSON API over HTTPS.

Rationale:
1. **Garmin compatibility** — `makeWebRequest()` requires HTTPS and
   natively handles JSON. REST is the only option that works on
   Garmin watches without hacks.
2. **Universal** — Every platform (web, iOS, Android, watch, CLI)
   has first-class HTTP/JSON support.
3. **Proportionate** — We have a handful of simple endpoints. REST
   is the right level of abstraction; GraphQL and gRPC add
   complexity without benefit at this scale.
4. **Cacheable** — Terrain lookups are highly cacheable. HTTP
   caching semantics (ETag, max-age) apply directly to GET requests.
5. **Future-proof** — If we add analysis-on-server later (ADR-0003
   Option C), it's just more REST endpoints.

## API Design Principles

- All endpoints under `/api/v1/` prefix
- JSON request and response bodies with `Content-Type: application/json`
- Standard HTTP methods: GET for reads, POST for batch operations
- Standard HTTP status codes: 200, 400, 401, 404, 429, 500, 503
- Error responses as `{ "error": "message", "code": "ERROR_CODE" }`
- Coordinates always as `{ "lat": number, "lon": number }`
- CORS headers for browser clients
- No authentication required initially (rate limiting by IP);
  API keys can be added later for mobile/watch clients

## Garmin Connect IQ Feasibility

Garmin watches (Fenix 8, Forerunner 965, Enduro 3, etc.) can
consume this API via:
- **Direct Wi-Fi** (Fenix 8 with Wi-Fi) — watch makes HTTPS
  requests directly
- **Phone proxy** (all Connect IQ devices) — watch sends request
  via Bluetooth to paired phone, which makes the HTTPS call and
  returns the response

Constraints for Garmin clients:
- HTTPS required (no HTTP)
- JSON response size limited (varies by device, typically 16–64 KB)
- Request timeout ~30 seconds
- Only GET and POST supported via `makeWebRequest()`

These constraints are easily met by our terrain lookup endpoints
(small JSON payloads, simple GET/POST).

## Consequences

- Requirement 15 (Deno Backend) is extended: all endpoints follow
  REST conventions and return JSON
- API documentation will use OpenAPI 3.x specification
- Response payloads are kept small (<16 KB per response) to
  support watch clients
- HTTPS is mandatory (already required for Garmin and good
  practice); TLS via Caddy/Let's Encrypt on the VPS
- Future clients (mobile app, watch app) can consume the same API
  without backend changes
- Rate limiting is applied per IP initially; API key auth can be
  layered in when needed

## References

- Garmin. (n.d.). *Connect IQ API — Communications module*.
  https://developer.garmin.com/connect-iq/api-docs/Toybox/Communications.html
- Fielding, R. T. (2000). *Architectural Styles and the Design of
  Network-based Software Architectures* (Doctoral dissertation).
  https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm
