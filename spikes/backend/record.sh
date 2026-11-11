#!/usr/bin/env bash
# Records the spike's results in results/, so that the ADR can point at stored output: the backoff tests of
# every stack and the measurements of every variant, each file with the date and the machine it ran on.
# Usage: ./record.sh   (needs Docker; takes some minutes; keep the machine otherwise idle for the ready times)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p results
stamp=$(date +%F)
machine="$(uname -sm), Docker: $(docker info --format '{{.NCPU}} CPUs, {{.MemTotal}} bytes memory')"
{
  echo "# Backoff tests, $stamp"
  echo "# $machine"
  ./test.sh 2>&1 | grep -E "^== |Tests run:|BUILD|✔|✖|ℹ (tests|pass|fail)|Passed!|Failed!|error"
} > "results/$stamp-tests.txt"
{
  echo "# Measurements, $stamp"
  echo "# $machine"
  echo "# Service limits: 1 CPU, 1 GB. Overpass is the stand-in server of fake-overpass/."
  ./measure.sh node
  ./measure.sh aspnet-core
  ./measure.sh spring-boot
  ./measure.sh spring-boot Dockerfile.leyden
  ./measure.sh micronaut
} > "results/$stamp-measure.txt"
echo "recorded in results/$stamp-*.txt"
