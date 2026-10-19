// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server.js";
import { matchScore } from "./matching.js";

const combatant = (over: Record<string, unknown>) => ({
  id: "c" + Math.random(),
  init: null,
  qty: 1,
  name: "x",
  isPC: false,
  maxHp: 10,
  units: [],
  loot: [],
  currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
  notes: "",
  ...over,
});

function writeData(dir: string, keys: Record<string, unknown>) {
  writeFileSync(path.join(dir, "data.json"), JSON.stringify({ version: 1, keys }));
}

async function connect(dir: string) {
  const server = createServer({ dataDir: dir });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0]!.text;
    return { isError: Boolean(res.isError), text, json: res.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}

describe("matching", () => {
  it("matches partial words and ignores 'the'", () => {
    expect(matchScore("the captain", "Brother-Captain")).toBe(2);
    expect(matchScore("Zombie", "zombie")).toBe(3);
    expect(matchScore("kobold", "Zombie")).toBe(0);
  });
});

describe("connector (single-campaign data file)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "conn-"));
    writeData(dir, {
      "dm-campaign-name-v1": "Winwoods",
      "dm-encounters-v1": [
        {
          id: "e1",
          name: "The Congregation",
          archived: false,
          createdAt: 1,
          combatants: [
            combatant({ name: "Balgor", isPC: true, maxHp: 40 }),
            combatant({
              name: "Hezzix the Devoted",
              maxHp: 52,
              loot: [{ id: "l1", name: "Amulet of the Devout +1", taken: false }],
            }),
            combatant({
              name: "Lizardfolk",
              qty: 3,
              loot: [{ id: "l2", name: "Potion of Heroism", taken: true }],
              stats: {
                srdId: null,
                srd: false,
                name: "Bayou Lizardfolk",
                cr: 0.5,
                ac: 15,
                hp: 38,
                hitDice: "7d8+7",
              },
            }),
          ],
        },
      ],
    });
  });

  it("lists the read tools (marked read only) and the write tools (marked not read only)", async () => {
    const { client } = await connect(dir);
    const { tools } = await client.listTools();
    const readOnly = tools
      .filter((t) => t.annotations?.readOnlyHint)
      .map((t) => t.name)
      .sort();
    const writes = tools
      .filter((t) => !t.annotations?.readOnlyHint)
      .map((t) => t.name)
      .sort();
    expect(readOnly).toEqual([
      "find_encounter",
      "find_loot",
      "find_monster",
      "find_npc",
      "get_party",
      "list_sessions",
    ]);
    expect(writes).toEqual(["add_loot", "import_session", "update_encounter", "upsert_npc"]);
  });

  it("get_party falls back to PCs seen in encounters", async () => {
    const { call } = await connect(dir);
    const { json } = await call("get_party");
    expect(json.campaign).toBe("Winwoods");
    expect(json.party.map((p: { name: string }) => p.name)).toEqual(["Balgor"]);
  });

  it("find_encounter and find_loot see the app's data", async () => {
    const { call } = await connect(dir);
    const enc = await call("find_encounter", { name: "congregation" });
    expect(enc.json.matches[0].combatants.map((c: { name: string }) => c.name)).toContain(
      "Hezzix the Devoted",
    );
    const loot = await call("find_loot", { name: "amulet" });
    expect(loot.json.matches).toMatchObject([
      { item: "Amulet of the Devout +1", carriedBy: "Hezzix the Devoted", taken: false },
    ]);
  });

  it("find_monster searches the bundled library and custom stat blocks", async () => {
    const { call } = await connect(dir);
    const lib = await call("find_monster", { name: "zombie", source: "library" });
    expect(lib.json.matches.length).toBeGreaterThan(0);
    expect(lib.json.matches[0].name.toLowerCase()).toContain("zombie");
    const custom = await call("find_monster", { name: "bayou", source: "custom" });
    expect(custom.json.matches).toMatchObject([{ name: "Bayou Lizardfolk", hp: 38 }]);
  });

  it("find_npc says plainly when there are no saved NPCs", async () => {
    const { call } = await connect(dir);
    const { json } = await call("find_npc", { name: "Hezzix" });
    expect(json.matches).toEqual([]);
    expect(json.note).toMatch(/no saved NPCs/);
  });

  it("reports a missing data file in plain language", async () => {
    const { call } = await connect(path.join(dir, "nope"));
    const res = await call("get_party");
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/Open the Encounter Tracker app/);
  });

  it("sees edits made after it connected", async () => {
    const { call } = await connect(dir);
    expect((await call("find_encounter", { name: "" })).json.totalEncounters).toBe(1);
    writeData(dir, { "dm-encounters-v1": [] });
    expect((await call("find_encounter", { name: "" })).json.totalEncounters).toBe(0);
  });
});

describe("connector (multi-campaign layout)", () => {
  it("reads party and NPCs from the roster and picks campaigns by name", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "conn-"));
    writeData(dir, {
      "dm-campaigns-v2": {
        activeId: "b",
        campaigns: [
          { id: "a", name: "Castaways", createdAt: 1 },
          { id: "b", name: "Winwoods", createdAt: 2 },
        ],
      },
      "dm-c-a-encounters": [],
      "dm-c-a-characters": [
        { id: "p1", role: "pc", name: "Mara", classes: "Rogue 3", race: "Elf", ac: 15, maxHp: 22 },
      ],
      "dm-c-b-encounters": [],
      "dm-c-b-characters": [
        { id: "p2", role: "pc", name: "Balgor", classes: "Fighter 5", ac: 18, maxHp: 52 },
        { id: "n1", role: "npc", name: "Brother-Captain", notes: "Leads the zealots" },
      ],
    });
    const { call } = await connect(dir);
    expect((await call("get_party")).json.party).toMatchObject([{ name: "Balgor", level: 5 }]);
    expect((await call("get_party", { campaign: "castaways" })).json.party).toMatchObject([
      { name: "Mara", level: 3 },
    ]);
    expect((await call("find_npc", { name: "the captain" })).json.matches).toMatchObject([
      { name: "Brother-Captain" },
    ]);
    expect((await call("get_party", { campaign: "nope" })).isError).toBe(true);
  });
});
