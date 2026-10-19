import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadMagicItems } from "@/lib/equipment";
import { loadLibrary } from "@/lib/monsters";
import { readKeys, defaultDataDir, writeKeys } from "./dataFile.js";
import { addLoot, editEncounter, listSessions } from "./edits.js";
import { planImport, upsertNpc, type Plan, type PlanItem, type Uncertain } from "./importer.js";
import { loadCampaigns, pickCampaign, type CampaignView } from "./model.js";
import { beatSchema, bundleSchema, lootSchema, npcSchema } from "./schema.js";
import { findEncounter, findLoot, findMonster, findNpc, getParty } from "./tools.js";

export const INSTRUCTIONS = `# Encounter Tracker

You build encounters, monsters, NPCs and loot in the GM's tracker from their adventure documents. The adventure doc stays the source of truth for story; the tracker holds only what the GM needs once dice are rolling. You do not run combat or record outcomes.

## What to extract from an adventure doc
- Every fight, and every hazard with stats, as an encounter.
- Every creature the GM may need to run: a library creature (by name), a library creature with overrides (e.g. hp), or a custom stat block only when the doc prints a full one.
- Every loot line, linked to the creature group that carries it, or left in the room it sits in.
- Round-by-round beats, tactics, morale and harvest checks, kept short.
- Every creature with a proper name goes on the NPC list, with or without stats. Unnamed roles stay off it.
- Do NOT import read-aloud text, lore, negotiation paths, skill-check chains or long clocks. Leave them in the doc.

## Rules
1. Search before you create. Call find_npc, find_encounter, find_monster and find_loot first, and treat entries the GM added by hand as canon. import_session also checks, and reuses exact matches instead of duplicating.
2. Prefer the library. If the doc cites a standard creature, use \`monster\`. Use \`overrides\` for adjusted HP or AC. Use \`custom\` only for a full stat block that is written in the doc. Never invent stats; if a stat block is incomplete, import what is written and say what is missing.
3. Set a default count and keep the doc's rule in \`countNote\` ("1 per PC", "4-6"). Use get_party for per-PC rules and the middle of a range. The GM adjusts counts before the fight.
4. Always call import_session without confirm first. Show the GM the preview in plain language (new, reused, updated, gaps, and any questions), wait for a clear yes, then call it again with confirm: true and the same planId and bundle. If something is uncertain, ask the GM; do not guess.
5. Mark conditional encounters status "dormant" with a trigger, e.g. "only if someone takes the chalice".
6. Location is the room key from the doc (G1, U3, B9). If there are none, use the scene name.
7. A bestiary with no fights imports as nothing: do not invent encounters.
8. Character sheets (PCs) are read only.
9. update_encounter, add_loot and upsert_npc change one thing right away. Use them only for a small edit the GM asked for, never to load a whole session.
10. Loot is always linked: to the creature group that carries it, or to the room (leave carriedBy out). Never loose.`;

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
    { name: "encounter-tracker", version: "0.2.0" },
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
    "Search encounters by name or alias (empty name lists them all) with their combatants, status and session. Call this before creating an encounter. Read only.",
    { name: z.string().describe("Name or part of a name; empty for all"), campaign },
    READ,
    ({ name, campaign }: { name: string; campaign?: string }) =>
      findEncounter(campaigns(), name, campaign),
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
        { [keys.encounters]: plan.encounters, [keys.characters]: plan.characters },
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
    ({ campaign: choice, ...npc }: z.infer<typeof npcSchema> & { campaign?: string }) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const characters = structuredClone(c.characters);
      const items: PlanItem[] = [];
      const uncertain: Uncertain[] = [];
      upsertNpc(characters, npc, "", items, uncertain);
      if (uncertain.length) return { saved: false, questions: uncertain };
      writeKeys({ [keys.characters]: characters }, dataDir);
      return { saved: true, campaign: c.name, result: items };
    },
  );

  register(
    "update_encounter",
    "Change one prepared encounter right away: rename it, set location, status (staged/dormant) and trigger, tactics, morale, replace its round beats, or change a creature group's count, count note or when it joins. Use only for a small edit the GM asked for.",
    {
      encounter: z.string().describe("Encounter name or alias"),
      name: z.string().optional(),
      location: z.string().optional(),
      status: z.enum(["staged", "dormant"]).optional(),
      trigger: z.string().optional(),
      tactics: z.string().optional(),
      morale: z.string().optional(),
      beats: z.array(beatSchema).optional().describe("Replaces all round beats"),
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
    ({
      campaign: choice,
      ...edit
    }: { campaign?: string } & Parameters<typeof editEncounter>[1]) => {
      const c = pickCampaign(campaigns(), choice);
      const keys = writable(c);
      const r = editEncounter(c, edit);
      if (r.changes.length) writeKeys({ [keys.encounters]: r.encounters }, dataDir);
      return { saved: r.changes.length > 0, encounter: r.encounter, changes: r.changes };
    },
  );

  register(
    "add_loot",
    "Add loot to an existing encounter, linked to the creature group that carries it (carriedBy) or, with carriedBy left out, to the room. Never loose: it always lands on a carrier or a room. Saves immediately; existing items with the same name are skipped.",
    {
      encounter: z.string().describe("Encounter name or alias"),
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
