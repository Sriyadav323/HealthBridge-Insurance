#!/bin/sh
set -eu
cd "$(dirname "$0")"
set -a
. ./.env.local
set +a
exec java -jar target/backend-0.0.1-SNAPSHOT.jar
