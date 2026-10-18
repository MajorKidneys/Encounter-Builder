#!/bin/bash
# Opens the Encounter Tracker from this repo's latest build, saving to the real data file
# (~/Library/Application Support/Encounter Tracker/data.json) that the connector reads.
# Uses its own port so it can run next to an installed copy.
set -e
cd "$(dirname "$0")/.."
npm run build >/dev/null
mkdir -p dist && ln -sfn ../.output/public dist/client
ENCOUNTER_TRACKER_PORT=47700 exec ./node_modules/.bin/electron . \
  --user-data-dir="$HOME/Library/Application Support/Encounter Tracker/profile"
