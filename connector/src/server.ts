import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadSpells } from "@/lib/spells";
import { loadMagicItems } from "@/lib/equipment";
import { loadLibrary } from "@/lib/monsters";
import { readKeys, defaultDataDir, writeKeys } from "./dataFile.js";
import { addLoot, editEncounter, listSessions } from "./edits.js";
import {
  planImport,
  saveSpellbook,
  upsertNpc,
  type Plan,
  type PlanItem,
  type Uncertain,
} from "./importer.js";
import { loadCampaigns, pickCampaign, type CampaignView } from "./model.js";
import {
  beatSchema,
  bundleSchema,
  folderSchema,
  locationSchema,
  lootSchema,
  npcSchema,
  pcSchema,
} from "./schema.js";
import {
  findEncounter,
  findLoot,
  findMonster,
  findNpc,
  getParty,
  listEncounters,
} from "./tools.js";

export const INSTRUCTIONS = `# Encounter Tracker

You build encounters, monsters, NPCs and loot in the GM's tracker from their adventure documents. The adventure doc stays the source of truth for story; the tracker holds only what the GM needs once dice are rolling. You do not run combat or record outcomes.

## What to extract from an adventure doc
- Every fight, and every hazard with stats, as an encounter.
- Every creature the GM may need to run: a library creature (by name), a library creature with overrides (e.g. hp), or a custom stat block only when the doc prints a full one.
- Every loot line, linked to the creature group that carries it, or left in the room it sits in.
- Round-by-round beats, tactics, morale and harvest checks, kept short.
- The setting: one short paragraph of where the scene is and what the GM needs to see at the table. Put it on the encounter as \`setting\`.
- Prep notes (DM only, never read aloud): \`tactics\`, \`morale\`, round \`beats\`, room \`loot\`, and for a conditional encounter \`status: "dormant"\` with a \`trigger\`.
- Every creature with a proper name goes on the NPC list, with or without stats. Unnamed roles stay off it.
- Do NOT import the rest of the read-aloud, lore, negotiation paths, skill-check chains or long clocks. Leave them in the doc.

## Rules
1. Search before you create. Call find_npc, find_encounter, find_monster and find_loot first, and treat entries the GM added by hand as canon. import_session also checks, and reuses exact matches instead of duplicating.
2. Prefer the library. If the doc cites a standard creature, use \`monster\`. Use \`overrides\` for adjusted HP or AC. Use \`custom\` only for a full stat block that is written in the doc. Never invent stats; if a stat block is incomplete, import what is written and say what is missing.
3. Set a default count and keep the doc's rule in \`countNote\` ("1 per PC", "4-6"). Use get_party for per-PC rules and the middle of a range. The GM adjusts counts before the fight.
4. Always call import_session without confirm first. Show the GM the preview in plain language (new, reused, updated, gaps, and any questions), wait for a clear yes, then call it again with confirm: true and the same planId and bundle. If something is uncertain, ask the GM; do not guess.
5. Mark conditional encounters status "dormant" with a trigger, e.g. "only if someone takes the chalice".
6. Location is a short room key from the doc (G1, U3, B9), 60 characters at most. If there are none, use the scene name. Never put a paragraph there.
6a. Keep the three ideas apart. \`setting\` is what you read aloud. \`location\` is a short key. Everything else the GM needs mid-fight (tactics, morale, beats, loot, trigger) is a prep note. Do not duplicate one in another.
6b. Group encounters in folders with \`folder\`, a path like "If they join the band / Sent on the raid" (3 levels at most). Folders follow the story's branches (choice, consequence, follow-up), not the session. Call list_encounters first and reuse the folder names already there. Encounter names can repeat across folders, so refer to one by id or "Folder / Name".
7. A bestiary with no fights imports as nothing: do not invent encounters.
8. Player characters are only written when the GM hands you a sheet to upload: use upsert_pc, after get_party shows whether the character already exists. Never edit a PC otherwise.
9. NPCs that cast or fight get a real sheet: pass ac, maxHp, abilities, saves, attacks, spellAbility/spellDc/spellAttack, prepared, slots and spellbook (all spells known) to upsert_npc or the import bundle, not just notes. The sheet shows in the app and the spellbook appears on the Spell Book page.
10. update_encounter, add_loot and upsert_npc change one thing right away. Use them only for a small edit the GM asked for, never to load a whole session.
11. Loot is always linked: to the creature group that carries it, or to the room (leave carriedBy out). Never loose.`;

type Annotations = { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean };

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);

function previewItems(items: PlanItem[]) {
  const shown = items.slice(0, 80);
  return {
    items: shown,
    ...(items.length > shown.length ? { itemsNotShown: items.length - shown.length } : {}),
  };
}

export function createServer(opts: { dataDir?: string } = {}) {
  const dataDir = opts.dataDir ?? defaultDataDir();
  const server = new McpServer(
    { name: "encounter-tracker", version: "0.3.0" },
    { instructions: INSTRUCTIONS },
  );

  // The callbacks below annotate their own argument types, which match each tool's shape.
  const register = (
    name: string,
    description: string,
    shape: z.ZodRawShape,
    annotations: Annotations,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run: (args: any) => unknown | Promise<unknown>,
  ) =>
    server.registerTool(
      name,
      { description, inputSchema: shape, annotations },
      async (args: Record<string, unknown>) => {
        try {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(await run(args), null, 2) }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
        }
      },
    );

  // Data is re-read on every call: the app (or the GM) may have changed it since the last one.
  const campaigns = () => loadCampaigns(readKeys(dataDir));
  const writable = (c: CampaignView) => {
    if (!c.keys)
      throw new Error(
        "Open the Encounter Tracker app once so it upgrades its data file, then try again.",
      );
    return c.keys;
  };
  const campaign = z
    .string()
    .optional()
    .describe("Campaign name or id. Defaults to the campaign open in the app.");
  const READ: Annotations = { readOnlyHint: true };
  const WRITE: Annotations = { readOnlyHint: false, destructiveHint: false };

  // ---- read ----
  register(
    "get_party",
    "List the player characters in a campaign with class, level, AC and HP. Use it for 'one per PC' counts. Read only.",
    { campaign },
    READ,
    ({ campaign }: { campaign?: string }) => getParty(campaigns(), campaign),
  );
  register(
    "find_npc",
    "Search saved NPCs by name or alias. Call this before creating or describing any NPC so hand-added entries are reused. Read only.",
    { name: z.string().describe("Name or part of a name"), campaign },
    READ,
    ({ name, campaign }: { name: string; campaign?: string }) =>
      findNpc(campaigns(), name, campaign),
  );
  register(
    "find_encounter",
    "Search encounters by name or alias (empty name lists them all) with id, folder, session, location, status, setting, trigger, tactics, morale, round beats, room loot and combatants. Call this before creating an encounter. Read only.",
    { name: z.string().describe("Name or part of a name; empty for all"), campaign },
    READ,
    ({ name, campaign }: { name: string; campaign?: string }) =>
      findEncounter(campaigns(), name, campaign),
  );
  register(
    "list_encounters",
    "Show every encounter laid out as the sidebar shows it: folders nested up to 3 deep, in order, each encounter with its id, session, location, status and whether it has a setting. Use it to see what folders exist before importing or moving anything. Read only.",
    { campaign },
    READ,
    ({ campaign }: { campaign?: string }) => listEncounters(campaigns(), campaign),
  );
  register(
    "find_monster",
    "Search the monster library (SRD 5.1 and Monstrous Menagerie) and custom stat blocks used in encounters. Returns summaries, not full stat blocks. Read only.",
    {
      name: z.string().describe("Creature name or part of one"),
      source: z.enum(["all", "library", "custom"]).default("all"),
    },
    READ,
    async ({ name, source }: { name: string; source: "all" | "library" | "custom" }) =>
      findMonster(await loadLibrary(), campaigns(), name, source),
  );
  register(
    "find_loot",
    "Search loot items carried by creatures or lying in rooms, with where each is and whether it was taken. Read only.",
    { name: z.string().describe("Item name or part of one"), campaign },
    READ,
    ({ name, campaign }: { name: string; campaign?: string }) =>
      findLoot(campaigns(), name, campaign),
  );
  register(
    "list_sessions",
    "List the adventure sessions already loaded, with counts of encounters, dormant encounters, creature groups and loot. Read only.",
    { campaign },
    READ,
    ({ campaign }: { campaign?: string }) => {
      const c = pickCampaign(campaigns(), campaign);
      return { campaign: c.name, sessions: listSessions(c) };
    },
  );

  // ---- write ----
  register(
    "import_session",
    "Load a prepared adventure session into the tracker: NPCs, encounters (creature groups, counts, tactics, morale, round beats, dormant triggers) and loot. " +
      "ALWAYS call first WITHOUT confirm: nothing is saved, and you get a preview with a planId. Show the GM the preview, wait for a clear yes, then call again with confirm: true, the same planId and the same bundle. " +
      "Exact matches with existing NPCs and encounters are reused, never duplicated; similar names are returned as questions for the GM. Loot must be linked to a creature group (loot on the group) or a room (loot on the encounter).",
    {
      ...bundleSchema.shape,
      confirm: z
        .boolean()
        .default(false)
        .describe("false (default) = preview only. true = save, and requires planId."),
      planId: z.string().optional().describe("The planId from the preview the GM approved"),
    },
    WRITE,
    async (args: z.infer<typeof bundleSchema> & { confirm: boolean; planId?: string }) => {
      const { confirm, planId, ...rest } = args;
      const bundle = bundleSchema.parse(rest);
      const c = pickCampaign(campaigns(), bundle.campaign);
      const keys = writable(c);
      const plan: Plan = planImport(c, bundle, {
        library: await loadLibrary(),
        magic: await loadMagicItems(),
        spells: await loadSpells(),
      });
      const id = fingerprint({ bundle, encounters: c.encounters, characters: c.characters });
      if (!confirm) {
        return {
          mode: "PREVIEW. Nothing has been saved.",
          campaign: c.name,
          session: bundle.session,
          planId: id,
          headline: plan.headline,
          ...previewItems(plan.items),
          gaps: plan.gaps,
          questions: plan.uncertain,
          next: plan.uncertain.length
            ? "Ask the GM the questions, fix the bundle, and preview again."
            : "Show this to the GM. After a clear yes, call import_session again with confirm: true, this planId and the same bundle.",
        };
      }
      if (planId !== id) {
        throw new Error(
          "The planId does not match this bundle and the tracker's current data (the bundle changed, or the tracker was edited since the preview). Run the preview again.",
        );
      }
      if (plan.uncertain.length) {
        throw new Error(`Not saved: ${plan.uncertain.map((u: Uncertain) => u.question).join(" ")}`);
      }
      writeKeys(
        {
          [keys.encounters]: plan.encounters,
          [keys.folders]: plan.folders,
          [keys.characters]: plan.characters,
          [keys.spellLists]: plan.spellLists,
        },
        dataDir,
      );
      return {
        mode: "SAVED",
        campaign: c.name,
        session: bundle.session,
        headline: plan.headline,
        ...previewItems(plan.items),
        gaps: plan.gaps,
      };
    },
  );

  register(
    "upsert_npc",
    "Add a named NPC to the campaign's NPC list, or add aliases and notes to the existing one when the name or an alias matches. Saves immediately. Use for a single NPC the GM asked for; use import_session to load a session.",
    { ...npcSchema.shape, campaign },
    WRITE,
    async ({ campaign: choice, ...npc }: z.infer<typeof npcSchema> & { campaign?: string }) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const characters = structuredClone(c.characters);
      const items: PlanItem[] = [];
      const uncertain: Uncertain[] = [];
      const saved = upsertNpc(characters, npc, "", items, uncertain);
      if (uncertain.length) return { saved: false, questions: uncertain };
      const spellLists = structuredClone(c.spellLists);
      const notInSrd =
        saved && npc.spellbook?.length
          ? saveSpellbook(spellLists, saved.name, npc.spellbook, await loadSpells())
          : [];
      writeKeys({ [keys.characters]: characters, [keys.spellLists]: spellLists }, dataDir);
      return {
        saved: true,
        campaign: c.name,
        result: items,
        ...(npc.spellbook?.length
          ? { spellbook: `${npc.spellbook.length - notInSrd.length} linked`, notInSrd }
          : {}),
      };
    },
  );

  register(
    "upsert_pc",
    "Upload a player character sheet to the campaign's party: race, class and level, AC, HP, speed, abilities, saves, attacks, spellcasting, prepared spells, slots, limited uses (Channel Divinity, Rage...), gear and notes. " +
      "Creates the character, or updates the one whose name matches (only the fields you send change, so hand edits and current slot use survive). Saves immediately; use only when the GM gave you a sheet to upload. A similar name comes back as a question.",
    { ...pcSchema.shape, campaign },
    WRITE,
    async ({ campaign: choice, ...pc }: z.infer<typeof pcSchema> & { campaign?: string }) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const characters = structuredClone(c.characters);
      const items: PlanItem[] = [];
      const uncertain: Uncertain[] = [];
      const saved = upsertNpc(characters, pc, "", items, uncertain, "pc");
      if (uncertain.length) return { saved: false, questions: uncertain };
      const spellLists = structuredClone(c.spellLists);
      const notInSrd =
        saved && pc.spellbook?.length
          ? saveSpellbook(spellLists, saved.name, pc.spellbook, await loadSpells())
          : [];
      writeKeys({ [keys.characters]: characters, [keys.spellLists]: spellLists }, dataDir);
      return {
        saved: true,
        campaign: c.name,
        result: items,
        ...(pc.spellbook?.length
          ? { spellbook: `${pc.spellbook.length - notInSrd.length} linked`, notInSrd }
          : {}),
      };
    },
  );

  const clearable = (what: string) =>
    z.string().nullable().optional().describe(`${what} Send null or "" to clear it.`);
  register(
    "update_encounter",
    "Change one prepared encounter right away: rename it, set or clear its setting (read aloud), session, location (short key), status (staged/dormant), trigger, tactics and morale, replace its round beats or its room loot, move it to a folder, or change a creature group's count, count note or when it joins. Use only for a small edit the GM asked for. Fields you leave out stay as they are.",
    {
      encounter: z
        .string()
        .describe('Encounter id, name or alias, or "Folder / Name" when the name repeats'),
      name: z.string().optional(),
      session: clearable("The session label."),
      location: locationSchema
        .nullable()
        .optional()
        .describe('A short room key, 60 characters at most. Send null or "" to clear it.'),
      status: z.enum(["staged", "dormant"]).optional(),
      trigger: clearable("Dormant trigger (prep note)."),
      tactics: clearable("How they fight (prep note)."),
      morale: clearable("When they run (prep note)."),
      setting: clearable("The read-aloud scene at the top of the encounter."),
      beats: z.array(beatSchema).optional().describe("Replaces all round beats; [] clears them"),
      roomLoot: z
        .array(lootSchema)
        .optional()
        .describe(
          "Replaces the loot lying in the room; items kept by name keep their collected state. [] clears it.",
        ),
      folder: folderSchema
        .nullable()
        .optional()
        .describe(
          'Move to this folder path, created if missing. null or "" moves to the top level.',
        ),
      groups: z
        .array(
          z.object({
            name: z.string().describe("Which creature group, by name"),
            count: z.number().int().min(1).max(50).optional(),
            countNote: z.string().optional(),
            joins: z
              .union([z.literal("start"), z.literal("manual"), z.number().int().min(1)])
              .optional(),
          }),
        )
        .optional(),
      campaign,
    },
    WRITE,
    async ({
      campaign: choice,
      ...edit
    }: { campaign?: string } & Parameters<typeof editEncounter>[1]) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const r = editEncounter(c, edit, await loadMagicItems());
      if (r.changes.length)
        writeKeys({ [keys.encounters]: r.encounters, [keys.folders]: r.folders }, dataDir);
      return { saved: r.changes.length > 0, encounter: r.encounter, changes: r.changes };
    },
  );

  register(
    "add_loot",
    "Add loot to an existing encounter, linked to the creature group that carries it (carriedBy) or, with carriedBy left out, to the room. Never loose: it always lands on a carrier or a room. Saves immediately; existing items with the same name are skipped.",
    {
      encounter: z.string().describe('Encounter id, name or alias, or "Folder / Name"'),
      carriedBy: z
        .string()
        .optional()
        .describe("Creature group name; omit for loot lying in the room"),
      loot: z.array(lootSchema).min(1),
      campaign,
    },
    WRITE,
    async ({
      campaign: choice,
      ...args
    }: {
      campaign?: string;
      encounter: string;
      carriedBy?: string;
      loot: z.infer<typeof lootSchema>[];
    }) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const r = addLoot(c, args, await loadMagicItems());
      if (r.added.length) writeKeys({ [keys.encounters]: r.encounters }, dataDir);
      return {
        saved: r.added.length > 0,
        encounter: r.encounter,
        where: r.where,
        added: r.added,
        alreadyThere: r.skipped,
      };
    },
  );

  return server;
}
