#!/usr/bin/env bash
# Measures one spike: image size, time to the first healthy answer, idle memory, memory after load.
# Usage: ./measure.sh <directory> [dockerfile]   e.g.  ./measure.sh spring-boot Dockerfile.leyden
# Needs Docker. The service asks Overpass through OVERPASS_URL. By default that is a stand-in container
# (fake-overpass/, the same recorded answer every time), so that the measurement neither loads a real
# Overpass server nor depends on it. For a realistic run against the local Overpass server of
# docker-compose.yml (profile "overpass"): OVERPASS_URL=http://host.docker.internal:8081/api/interpreter
# The service runs with a small VPS's resources: MEMORY (default 1g) and CPUS (default 1).
set -euo pipefail
dir="$1"
dockerfile="${2:-Dockerfile}"
name="spike-$dir-$(echo "$dockerfile" | tr 'A-Z.' 'a-z-')"
memory="${MEMORY:-1g}"
cpus="${CPUS:-1}"
network=spike-net
fake=spike-fake-overpass
overpass="${OVERPASS_URL:-http://$fake:8081/api/interpreter}"
port=18080

here="$(cd "$(dirname "$0")" && pwd)"
docker network create "$network" >/dev/null 2>&1 || true
if [ -z "${OVERPASS_URL:-}" ]; then
  docker rm -f "$fake" >/dev/null 2>&1 || true
  docker run -d --name "$fake" --network "$network" -v "$here/fake-overpass:/app:ro" python:3.13-alpine python /app/server.py >/dev/null
fi
cd "$here/$dir"
build_start=$(date +%s)
docker build -q -f "$dockerfile" -t "$name" . >/dev/null
build_seconds=$(( $(date +%s) - build_start ))
size=$(docker image inspect "$name" --format '{{.Size}}' | awk '{printf "%.0f", $1/1048576}')

docker rm -f "$name" >/dev/null 2>&1 || true
start=$(python3 -c 'import time; print(time.time())')
docker run -d --name "$name" --network "$network" --memory "$memory" --cpus "$cpus" -p "$port:8080" --add-host host.docker.internal:host-gateway -e OVERPASS_URL="$overpass" "$name" >/dev/null
until curl -sf "http://127.0.0.1:$port/api/v1/health" >/dev/null; do sleep 0.05; done
ready=$(python3 -c "import time; print(round(time.time() - $start, 2))")

sleep 20
idle=$(docker stats --no-stream --format '{{.MemUsage}}' "$name" | cut -d/ -f1 | tr -d ' ')
# Overpass refuses an identical query repeated from the same client ("duplicate_query"), so every
# request gets its own bounding box: the south edge moves by a tenth of a millimetre per request.
water() { curl -s "http://127.0.0.1:$port/api/v1/water?bbox=52.228$(printf '%03d' "$1"),4.94,52.256,4.97"; }
ok=0
for i in $(seq 100); do
  body=$(water "$i" | head -c 1) || true   # head closes the pipe early: that is not an error
  [ "$body" = "{" ] && ok=$((ok + 1))
done
sleep 5
loaded=$(docker stats --no-stream --format '{{.MemUsage}}' "$name" | cut -d/ -f1 | tr -d ' ')
water_ok="$ok of 100 answers were JSON"

docker rm -f "$name" >/dev/null
[ -z "${OVERPASS_URL:-}" ] && docker rm -f "$fake" >/dev/null
printf '%s | image %s MB | build %s s | limits %s CPU, %s | ready %s s | idle %s | after 100 water requests %s | water: %s\n' "$name" "$size" "$build_seconds" "$cpus" "$memory" "$ready" "$idle" "$loaded" "$water_ok"
