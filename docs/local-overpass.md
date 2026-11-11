# Local Overpass server (optional)

TigerLegs asks the public Overpass API for the water around a track, and a busy server answers with an error and the request to retry with exponential backoff (see [overpass.ts](../src/client/overpass.ts)).
For development, and especially for recording the test fixtures of [test/fixtures/](../test/fixtures/), you can run your own Overpass server, so that the public servers are not hit and your IP address does not end up on a block list.
You do not need this to build, test or use TigerLegs: the fixtures are committed and the app uses the public servers.

## What data is needed

The water detection reads `natural=water` and `waterway=riverbank` (lakes, ponds, rivers) with their nodes, and the sea needs `natural=coastline` (planned, issue #36).
A map with roads and labels (planned) adds `highway` and `place`.
Overpass imports a complete extract and cannot import a part of it, so import the smallest extract that covers your courses.
We do not need the derived "area" objects or the metadata, and the compose file leaves them out, which saves import time and disk space.
Expect the database to be several times the size of the download; the upstream manual gives 4 to 5 times (b1tw153, n.d.).

## One-time setup

You need Docker. The Overpass server is a service of the main `docker-compose.yml`, in the profile `overpass`, so the normal `docker compose up --build` (the API) does not start it or download anything.

First download the extract once on the host, resumable, into the git-ignored `overpass-data/downloads/` (a few GB; Geofabrik offers PBF files, Geofabrik, n.d.):

```sh
mkdir -p overpass-data/downloads
curl -L -C - --retry 20 --retry-delay 10 --retry-all-errors \
  -o overpass-data/downloads/netherlands-latest.osm.pbf \
  https://download.geofabrik.de/europe/netherlands-latest.osm.pbf
```

Then start the server and follow the import:

```sh
docker compose --profile overpass up -d overpass
docker compose logs -f overpass
```

The first start converts the PBF to the format the image imports and builds the database in `overpass-data/netherlands/`, also git-ignored; this takes a while and needs several times the size of the download in free disk space.
When the log says the database is created, the same container serves `http://127.0.0.1:8081/api/interpreter`; later starts skip the import.
Stop it with `docker compose --profile overpass down`; the data stays in `overpass-data/`.

The API can use it: `OVERPASS_API_URL=http://overpass/api/interpreter docker compose --profile overpass up --build` (inside the compose network the service is `overpass` on port 80).

Another region goes in its own folder, for example the area of the Cannes race (Geofabrik, n.d.):

```sh
curl -L -C - --retry 20 --retry-all-errors \
  -o overpass-data/downloads/provence-alpes-cote-d-azur-latest.osm.pbf \
  https://download.geofabrik.de/europe/france/provence-alpes-cote-d-azur-latest.osm.pbf
REGION=cannes EXTRACT_FILE=provence-alpes-cote-d-azur-latest.osm.pbf \
  DIFF_URL=https://download.geofabrik.de/europe/france/provence-alpes-cote-d-azur-updates/ \
  docker compose --profile overpass up -d overpass
```

The compose file uses the `wiktorn/overpass-api` image because it has a native arm64 build for Apple Silicon (Wiktorn, n.d.); the `b1tw153/overpass-api` image from the manual below only exists for amd64.

## Record a fixture

Ask for the same query the app sends, for the area of the track (the app grows it to a 0.05 degree grid; a fixture can use the plain extent):

```sh
curl --data-urlencode 'data=[out:json][timeout:25];(way["natural"="water"](52.228,4.94,52.256,4.97);relation["natural"="water"](52.228,4.94,52.256,4.97);way["waterway"="riverbank"](52.228,4.94,52.256,4.97););out geom;' \
  http://127.0.0.1:8081/api/interpreter -o test/fixtures/rondje-eilanden-overpass.json
```

Keep fixtures small (the Rhederlaag one is 0.4 MB): use a tight bounding box.
Note in the test which snapshot the fixture comes from.

The server proxy of TigerLegs can use the local server too: start it with `OVERPASS_API_URL=http://127.0.0.1:8081/api/interpreter`.

## Further reading

- Upstream manual for the Overpass API Docker image, with the import options and resource notes: https://github.com/b1tw153/Overpass-API/blob/main/README.md
- The image used here: https://github.com/wiktorn/Overpass-API

## Look at the data with Overpass Turbo

The local server is an API only: it answers `http://127.0.0.1:8081/api/interpreter` for queries and `http://127.0.0.1:8081/api/status` for its state, and has no web page of its own.
[Overpass Turbo](https://overpass-turbo.eu/) is the web interface for writing and running queries on a map. In its settings, set the server to `http://127.0.0.1:8081/api/` and it uses the local server instead of a public one.
The local server answers with `Access-Control-Allow-Origin: *`, so the browser accepts its answers on the Overpass Turbo page. Whether a browser blocks a page from `https` calling a local `http` address depends on the browser; Chrome and Firefox treat `127.0.0.1` as a trustworthy address (not verified here, so try it).

## References

b1tw153. (n.d.). *Overpass-API* [README]. GitHub. Retrieved November 10, 2026, from https://github.com/b1tw153/Overpass-API/blob/main/README.md

Geofabrik. (n.d.). *OpenStreetMap data extracts*. Retrieved November 10, 2026, from https://download.geofabrik.de/

Wiktorn. (n.d.). *Overpass-API* [Docker image and README]. GitHub. Retrieved November 10, 2026, from https://github.com/wiktorn/Overpass-API
