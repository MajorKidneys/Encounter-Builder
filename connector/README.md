# Encounter Tracker connector

An MCP server that lets Claude read your Encounter Tracker data. It runs on your Mac and reads the
same file the app saves to: `~/Library/Application Support/Encounter Tracker/data.json`
(override the folder with `ENCOUNTER_TRACKER_DATA_DIR`). Nothing leaves your machine.

## Tools

Read (never change anything):

| Tool | What it does |
| --- | --- |
| `get_party` | PCs for a campaign (saved roster, or PCs seen in encounters) |
| `find_npc` | Saved NPCs by name or alias |
| `find_encounter` | Encounters by name, with combatants (empty name lists all) |
| `find_monster` | SRD / Monstrous Menagerie library plus custom stat blocks |
| `find_loot` | Loot items, who carries them or which room, and whether they were taken |
| `list_sessions` | Sessions already loaded, with counts |

Write:

| Tool | What it does |
| --- | --- |
| `import_session` | Loads a prepared session (NPCs, encounters, groups, loot). **Preview first**: nothing is saved until it is called again with `confirm: true` and the `planId` from the preview. Exact matches are reused, similar names come back as questions. |
| `upsert_npc` | Adds an NPC, or adds aliases/notes to the matching one |
| `update_encounter` | Small edits: location, dormant/staged, trigger, tactics, morale, beats, a group's count |
| `add_loot` | Adds loot to a creature group or to the room |

Rows are built with the app's own code (monster library, native gear, AC), so they match ones added by hand.
Not built: starting fights, damage, recording outcomes, editing PCs.

## Build and run

```sh
cd connector
npm install
npm run build        # typechecks, then bundles to dist/index.js (includes the app code it shares)
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

Restart Claude desktop after every rebuild. To try it against a sandbox instead of your real data, add
`"env": { "ENCOUNTER_TRACKER_DATA_DIR": "/some/folder" }` to that entry.
