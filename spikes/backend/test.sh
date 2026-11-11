#!/usr/bin/env bash
# Runs the tests of the spikes (the exponential backoff of the Overpass client) inside containers, so that
# no JDK, .NET SDK or Node.js is needed on the machine. Usage: ./test.sh [spring-boot|micronaut|node|aspnet-core]
set -euo pipefail
cd "$(dirname "$0")"
run() {
  case "$1" in
    spring-boot) docker run --rm -v "$PWD/spring-boot:/src" -v spike-m2:/root/.m2 -w /src maven:3.9-eclipse-temurin-25 mvn -B -ntp test -Dtest=OverpassTest ;;
    micronaut) docker run --rm -v "$PWD/micronaut:/src" -v spike-m2:/root/.m2 -w /src maven:3.9-eclipse-temurin-25 mvn -B -ntp test -Dtest=OverpassTest ;;
    node) docker run --rm -v "$PWD/node:/app" -w /app node:24-alpine node --test ;;
    aspnet-core) docker run --rm -v "$PWD/aspnet-core:/src" -v spike-nuget:/root/.nuget -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet test Spike.Tests/Spike.Tests.csproj ;;
    *) echo "unknown spike: $1" >&2; exit 1 ;;
  esac
}
if [ "$#" -eq 0 ]; then set -- spring-boot micronaut node aspnet-core; fi
for spike in "$@"; do echo "== $spike"; run "$spike"; done
