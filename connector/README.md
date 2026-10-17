# Encounter Tracker connector

An MCP server that lets Claude read your Encounter Tracker data. It runs on your Mac and reads the
same file the app saves to: `~/Library/Application Support/Encounter Tracker/data.json`
(override the folder with `ENCOUNTER_TRACKER_DATA_DIR`). Nothing leaves your machine.

## Tools (read only so far)

| Tool | What it does |
| --- | --- |
| `get_party` | PCs for a campaign (saved roster, or PCs seen in encounters) |
| `find_npc` | Saved NPCs by name |
| `find_encounter` | Encounters by name, with combatants (empty name lists all) |
| `find_monster` | SRD / Monstrous Menagerie library plus custom stat blocks |
| `find_loot` | Loot items, who carries them, and whether they were taken |

Writing tools (`import_session`, `create_encounter`, `add_loot`, ...) come next. See the design doc.

## Build and run

```sh
cd connector
npm install
npm run build        # compiles to dist/
npm test             # runs from the repo root: vitest run connector
```

## Add to Claude desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "encounter-tracker": {
      "command": "node",
      "args": ["/absolute/path/to/encounter-builder/connector/dist/index.js"]
    }
  }
}
```

Restart Claude desktop. The monster library is read from `../src/data` (override with
`ENCOUNTER_TRACKER_LIBRARY_DIR`).
