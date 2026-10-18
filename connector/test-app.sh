#!/bin/bash
# Opens a test copy of the Encounter Tracker that uses the sandbox data folder the connector is
# pointed at, on its own port, so it never touches your real campaign or the installed app.
set -e
cd "$(dirname "$0")/.."
[ -d .output/public ] || npm run build
mkdir -p dist && ln -sfn ../.output/public dist/client
ENCOUNTER_TRACKER_PORT=47700 \
ENCOUNTER_TRACKER_DATA_DIR="$HOME/Library/Application Support/Encounter Tracker Test" \
  exec ./node_modules/.bin/electron . --user-data-dir="$HOME/Library/Application Support/Encounter Tracker Test/profile"
