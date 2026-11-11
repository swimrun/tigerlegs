# 13. The back end is optional

Date: 2026-11-10

## 1. Status

Draft. No decision has been taken; this record states the principle and the open choices for issue #58. It builds on [ADR-0003](./0003-gpx-analysis-execution-location.md) (analysis in the browser), [ADR-0004](./0004-host-deno-backend-on-eu-vps.md) (EU hosting) and [ADR-0005](./0005-rest-json-api-for-multi-client-support.md) (REST/JSON API).

## 2. Context

TigerLegs analyses a GPX file in the browser and keeps the GPX file on the device.
A back end is wanted for things the browser cannot do alone: saved and shared courses, a hosted terrain service with a quality of service the public Overpass servers cannot give (#57), the MCP server and Strava integration (ADR-0010) and training plans (spec 003).
Those are premium features.
The research issues #13 and #6 compare back-end technologies (Deno or Spring Boot); this record sets the requirement they must meet.

## 3. Principle

The front end works fully without the back end.
Connecting to it is optional, and it is a premium feature.
A missing, offline or slow back end must never block the free path: analysis, the map, the segment table, terrain through the public servers (with backoff and cache, #50) and the on-device assistant (ADR-0010).

## 4. Options for how the front end knows

| Option | How it works | For | Against |
| --- | --- | --- | --- |
| **A. Explicit connection state** | The user connects (signs in); the front end holds one of: not connected, connected, unreachable, not premium. Nothing is requested while not connected. | Clear to the user, nothing leaves the device by surprise (privacy), simple to test | The user must take a step before a premium feature works |
| **B. Probe the health endpoint on load** | The front end calls `GET /api/v1/health` at start and enables features when it answers | No step for the user | A request on every visit to a server we run, even for free users; flaky detection on slow networks |
| **C. Probe lazily** | Ask only when a premium feature is opened | No request for free users | A delay at the moment of use; the state is still needed |

The working hypothesis is **A**, with **C** for the reachability check once connected.

## 5. Consequences

- Each back-end feature gets a test with the back end absent, slow and failing, as well as present.
- Everything behind the front end is container based: the back end ships as a Docker image (`Dockerfile`, as ADR-0004 requires) and runs locally with `docker compose up --build` (API on http://localhost:8123); the optional local Overpass server is a container too (`docker-compose.overpass.yml`). The same image runs on the EU VPS behind Caddy or nginx, so what we test locally is what we host. Playwright runs the site against the local container and against no back end.
- Premium features are marked in the interface and say what they need; they never remove a free feature.
- Hosting our own Overpass server (#57) sits behind the back end; the front end keeps the public servers as the fallback.
- Whatever data the back end stores needs the privacy review of roadmap M9 first.

## 6. Validation

- A spike with a front-end connection state and one back-end call, run against the local back end, an unreachable URL and a slow one.
- Decide the back-end technology in #13 with this requirement as a criterion.
