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
| `find_encounter` | Encounters by name or alias with id, folder, session, location, status, setting, trigger, tactics, morale, round beats, room loot, and combatants (empty name lists all) |
| `find_monster` | SRD / Monstrous Menagerie library plus custom stat blocks |
| `find_loot` | Loot items, who carries them or which room, and whether they were taken |
| `list_encounters` | Every encounter laid out like the sidebar: folders nested up to 3 deep, in order, with id, session, location, status |
| `list_sessions` | Sessions already loaded, with counts |

Write:

| Tool | What it does |
| --- | --- |
| `import_session` | Loads a prepared session (NPCs, encounters, groups, loot, and a short setting description). **Preview first**: nothing is saved until it is called again with `confirm: true` and the `planId` from the preview. Exact matches are reused, similar names come back as questions. |
| `upsert_npc` | Adds an NPC, or adds aliases/notes to the matching one |
| `upsert_pc` | Uploads a player character sheet (class, AC, HP, abilities, attacks, spells, slots, limited uses, gear); updates the matching PC |
| `update_encounter` | Small edits: rename, set or clear setting, session, location, trigger, tactics, morale; dormant/staged; replace beats or room loot; move to a folder; a group's count. `null` or `""` clears a field |
| `add_loot` | Adds loot to a creature group or to the room |

### Setting, prep notes, location, folders

The app keeps four separate ideas, and the tools do too:

- **Setting** is the paragraph the GM reads aloud. `setting` on an encounter.
- **Prep notes** are DM only: `tactics`, `morale`, round `beats`, room `loot`, and for a conditional encounter `status: "dormant"` with a `trigger`. They can be edited in the app as well.
- **Location** is a short room key such as `G1` or `U3`, 60 characters or fewer. Longer text is refused with a pointer to `setting`.
- **Folders** group encounters by story branch, up to 3 levels deep. Pass `folder: "If they join the band / Sent on the raid"` on import or to `update_encounter`; missing folders are created, existing ones are matched ignoring case. Run `list_encounters` first to reuse names. Encounter names can repeat across folders, so `update_encounter` and `add_loot` accept an encounter id or `"Folder / Name"`, and an ambiguous bare name returns the choices with their paths and ids.

Folders are stored in `dm-c-<id>-folders`; an encounter's place is `folderId` and `sort` on the encounter.

Rows are built with the app's own code (monster library, native gear, AC), so they match ones added by hand.
Not built: starting fights, damage, recording outcomes. PCs are only written by `upsert_pc`.

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
