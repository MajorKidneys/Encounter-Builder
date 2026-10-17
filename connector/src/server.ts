import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readKeys, defaultDataDir } from "./dataFile.js";
import { loadLibrary, defaultLibraryDir } from "./library.js";
import { loadCampaigns } from "./model.js";
import { findEncounter, findLoot, findMonster, findNpc, getParty } from "./tools.js";

export const INSTRUCTIONS = `# Encounter Tracker

This connector reads the GM's Encounter Tracker: campaigns, party, encounters, loot, NPCs and the monster library.
The adventure document stays the source of truth for story. The tracker holds only what the GM needs once dice are rolling.

Current abilities: look things up. There are no tools yet to create or change encounters, monsters or loot, so do not promise to build them.

## Rules
1. Look before you answer. Call the find_ tools instead of guessing what is in the tracker, and treat entries the GM added by hand as canon.
2. Never invent stats. If the library has no match, say so.
3. A campaign argument is optional. Leave it out to use the campaign the GM has open.
4. Character data is read only.`;

export function createServer(opts: { dataDir?: string; libraryDir?: string } = {}) {
  const dataDir = opts.dataDir ?? defaultDataDir();
  const libraryDir = opts.libraryDir ?? defaultLibraryDir();
  const server = new McpServer(
    { name: "encounter-tracker", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  // Data is re-read on every call: the app (or the GM) may have changed it since the last one.
  // The callbacks below annotate their own argument types, which match each tool's shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const register = (name: string, description: string, shape: z.ZodRawShape, run: (args: any) => unknown) =>
    server.registerTool(
      name,
      { description, inputSchema: shape, annotations: { readOnlyHint: true } },
      async (args: Record<string, unknown>) => {
        try {
          return { content: [{ type: "text" as const, text: JSON.stringify(run(args), null, 2) }] };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          };
        }
      },
    );

  const campaigns = () => loadCampaigns(readKeys(dataDir));
  const campaign = z.string().optional().describe("Campaign name or id. Defaults to the campaign open in the app.");

  register(
    "get_party",
    "List the player characters in a campaign with class, level, AC and HP. Use it for 'one per PC' counts. Read only.",
    { campaign },
    ({ campaign }: { campaign?: string }) => getParty(campaigns(), campaign),
  );
  register(
    "find_npc",
    "Search saved NPCs by name. Call this before creating or describing any NPC so hand-added entries are reused. Read only.",
    { name: z.string().describe("Name or part of a name"), campaign },
    ({ name, campaign }: { name: string; campaign?: string }) => findNpc(campaigns(), name, campaign),
  );
  register(
    "find_encounter",
    "Search encounters by name (empty name lists them all) with their combatants. Call this before creating an encounter. Read only.",
    { name: z.string().describe("Name or part of a name; empty for all"), campaign },
    ({ name, campaign }: { name: string; campaign?: string }) => findEncounter(campaigns(), name, campaign),
  );
  register(
    "find_monster",
    "Search the monster library (SRD 5.1 and Monstrous Menagerie) and custom stat blocks used in encounters. Returns summaries, not full stat blocks. Read only.",
    {
      name: z.string().describe("Creature name or part of one"),
      source: z.enum(["all", "library", "custom"]).default("all"),
    },
    ({ name, source }: { name: string; source: "all" | "library" | "custom" }) => findMonster(loadLibrary(libraryDir), campaigns(), name, source),
  );
  register(
    "find_loot",
    "Search loot items carried by creatures in encounters, with who carries them and whether they were taken. Read only.",
    { name: z.string().describe("Item name or part of one"), campaign },
    ({ name, campaign }: { name: string; campaign?: string }) => findLoot(campaigns(), name, campaign),
  );

  return server;
}
