// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server.js";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let dir: string;
const file = () => path.join(dir, "data.json");
const keys = (): J => JSON.parse(readFileSync(file(), "utf8")).keys;
const encounters = (): J[] => keys()["dm-c-c1-encounters"];
const characters = (): J[] => keys()["dm-c-c1-characters"];
const enc = (name: string) => encounters().find((e) => e.name === name)!;

function seed(extra: J = {}) {
  writeFileSync(
    file(),
    JSON.stringify({
      version: 1,
      keys: {
        "dm-campaigns-v2": {
          activeId: "c1",
          campaigns: [{ id: "c1", name: "Winwoods", createdAt: 1 }],
        },
        "dm-c-c1-encounters": [],
        "dm-c-c1-characters": [
          { id: "pc1", role: "pc", name: "Balgor", classes: "Fighter 5" },
          { id: "n1", role: "npc", name: "Brother-Captain", notes: "Leads the zealots" },
        ],
        "dm-c-c1-spell-lists": [],
        ...extra,
      },
    }),
  );
}

async function connect() {
  const server = createServer({ dataDir: dir });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return async (name: string, args: J = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0]!.text;
    return {
      isError: Boolean(res.isError),
      text,
      json: (res.isError ? null : JSON.parse(text)) as J,
    };
  };
}

// The Beat 4 example from the design doc, with its dormant and room-loot companions.
const congregation = {
  name: "The Congregation",
  location: "U3 approach",
  tactics: "Never attacks first. Bless R1, Hold Person R2. Warriors gang up 3:1.",
  morale: "Break at 50% casualties or Hezzix down; retreat to the river.",
  beats: [
    { round: 1, text: "Hezzix casts bless" },
    { round: "4+", text: "Warriors shove toward the water" },
  ],
  groups: [
    {
      name: "Hezzix the Devoted",
      npc: "Hezzix",
      custom: {
        name: "Hezzix the Devoted",
        meta: "Medium humanoid, neutral",
        ac: 15,
        hp: 52,
        hitDice: "8d8+16",
        cr: 5,
        actions: [
          { name: "Mace", desc: "Melee weapon attack", attack: 5, damage: "1d6+2 bludgeoning" },
        ],
      },
      loot: [
        { name: "Amulet of the Devout +1", condition: "Negotiation gift or combat" },
        { name: "Necklace of Adaptation", condition: "Negotiation gift or combat" },
      ],
    },
    {
      name: "Lizardfolk warriors",
      monster: "Lizardfolk",
      count: 3,
      countNote: "groups of 2-3",
      overrides: { hp: 38, hitDice: "7d8+7" },
      loot: [{ name: "Periapt of Wound Closure", condition: "Senior warrior" }],
    },
    {
      name: "Lizardfolk warriors",
      monster: "Lizardfolk",
      count: 3,
      overrides: { hp: 38 },
      joins: "manual",
      loot: [{ name: "Potion of Heroism", description: "Carrier doesn't know what it is" }],
    },
  ],
};
const passage = {
  name: "Smuggler's Passage",
  location: "B9",
  loot: [{ name: "Onyx stones", quantity: 6, value: "50 gp" }],
};
const orveth = {
  name: "The Orveth",
  location: "B12",
  status: "dormant" as const,
  trigger: "Only if negotiation succeeds fast",
  morale: "Retreats at 50 HP",
  groups: [
    {
      name: "Orveth",
      custom: { name: "Orveth", ac: 14, hp: 110 },
      loot: [{ name: "Orveth venom", harvest: { skill: "Medicine", dc: 14 }, value: "300 gp" }],
    },
  ],
};
const bundle = {
  session: "Winwoods S1 — Homecoming",
  npcs: [{ name: "Hezzix", description: "Lizardfolk shaman" }],
  encounters: [congregation, passage, orveth],
};

describe("import_session", () => {
  let call: Awaited<ReturnType<typeof connect>>;
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "write-"));
    seed();
    call = await connect();
  });

  it("previews without saving, then saves only with the matching planId", async () => {
    const before = readFileSync(file(), "utf8");
    const preview = await call("import_session", bundle);
    expect(preview.json.mode).toMatch(/PREVIEW/);
    expect(preview.json.planId).toMatch(/^[0-9a-f]{12}$/);
    expect(preview.json.headline).toMatch(/3 new/);
    expect(readFileSync(file(), "utf8")).toBe(before);

    expect((await call("import_session", { ...bundle, confirm: true })).isError).toBe(true);
    expect(
      (await call("import_session", { ...bundle, confirm: true, planId: "000000000000" })).isError,
    ).toBe(true);
    expect(
      (
        await call("import_session", {
          ...bundle,
          confirm: true,
          planId: preview.json.planId,
          session: "Other",
        })
      ).isError,
    ).toBe(true);
    expect(readFileSync(file(), "utf8")).toBe(before);

    const saved = await call("import_session", {
      ...bundle,
      confirm: true,
      planId: preview.json.planId,
    });
    expect(saved.json.mode).toBe("SAVED");
    expect(encounters().map((e) => e.name)).toEqual([
      "The Congregation",
      "Smuggler's Passage",
      "The Orveth",
    ]);
  });

  it("builds the congregation the way the design says", async () => {
    const p = await call("import_session", bundle);
    await call("import_session", { ...bundle, confirm: true, planId: p.json.planId });
    const e = enc("The Congregation");
    expect(e).toMatchObject({
      session: "Winwoods S1 — Homecoming",
      location: "U3 approach",
      status: "staged",
    });
    expect(e.beats).toEqual(bundle.encounters[0]!.beats);
    expect(e.morale).toMatch(/Break at 50%/);
    expect(e.combatants.map((c: J) => c.name)).toEqual([
      "Hezzix the Devoted",
      "Lizardfolk warriors",
      "Lizardfolk warriors 2",
    ]);

    const [hezzix, wave1, wave2] = e.combatants;
    expect(hezzix.stats).toMatchObject({ hp: 52, ac: 15, srdId: null });
    expect(hezzix.loot.map((l: J) => l.name)).toEqual([
      "Amulet of the Devout +1",
      "Necklace of Adaptation",
    ]);
    expect(hezzix.loot[0].condition).toBe("Negotiation gift or combat");
    const hezzixNpc = characters().find((c) => c.name === "Hezzix")!;
    expect(hezzix.npcId).toBe(hezzixNpc.id);
    expect(hezzixNpc).toMatchObject({ role: "npc", notes: "Lizardfolk shaman" });

    // Library creature with overrides: the library's stats, but 38 HP, three copies, rule kept as a note.
    expect(wave1).toMatchObject({ qty: 3, maxHp: 38, countNote: "groups of 2-3" });
    expect(wave1.units).toHaveLength(3);
    expect(wave1.units.every((u: J) => u.hp === 38)).toBe(true);
    expect(wave1.stats).toMatchObject({ hp: 38, hitDice: "7d8+7", srdId: "lizardfolk" });
    expect(wave1.init).toBeNull();
    expect(wave2.joins).toBe("manual");
    expect(wave2.loot.find((l: J) => l.name === "Potion of Heroism")).toMatchObject({
      name: "Potion of Heroism",
      desc: expect.stringContaining("doesn't know"),
    });
  });

  it("links room loot with no fight, and dormant encounters with their triggers and harvest checks", async () => {
    const p = await call("import_session", bundle);
    await call("import_session", { ...bundle, confirm: true, planId: p.json.planId });
    const room = enc("Smuggler's Passage");
    expect(room.combatants).toEqual([]);
    expect(room.roomLoot).toMatchObject([{ name: "Onyx stones ×6", value: "50 gp", taken: false }]);
    const dormant = enc("The Orveth");
    expect(dormant).toMatchObject({
      status: "dormant",
      trigger: "Only if negotiation succeeds fast",
      morale: "Retreats at 50 HP",
    });
    expect(dormant.combatants[0].loot[0]).toMatchObject({
      name: "Orveth venom",
      harvest: { skill: "Medicine", dc: 14 },
    });
  });

  it("installs the library's native gear like the app does for a hand-added creature", async () => {
    const b = {
      session: "S",
      encounters: [{ name: "Gate", groups: [{ monster: "Guard", count: 2 }] }],
    };
    const p = await call("import_session", b);
    await call("import_session", { ...b, confirm: true, planId: p.json.planId });
    const guard = enc("Gate").combatants[0];
    expect(guard.stats.srdId).toBe("guard");
    expect(guard.loot.some((l: J) => l.native)).toBe(true);
  });

  it("is idempotent: importing the same session again creates nothing new", async () => {
    const p = await call("import_session", bundle);
    await call("import_session", { ...bundle, confirm: true, planId: p.json.planId });
    const snapshot = JSON.stringify(keys()["dm-c-c1-encounters"]);
    const npcCount = characters().length;
    const again = await call("import_session", bundle);
    expect(again.json.headline).toMatch(/0 new, 0 updated, 3 already there/);
    await call("import_session", { ...bundle, confirm: true, planId: again.json.planId });
    expect(JSON.stringify(encounters())).toBe(snapshot);
    expect(characters()).toHaveLength(npcCount);
  });

  it("reuses encounters the GM made by hand, filling gaps without overwriting their edits", async () => {
    seed({
      "dm-c-c1-encounters": [
        {
          id: "hand",
          name: "Flooded Nave",
          archived: false,
          createdAt: 1,
          tactics: "My own tactics",
          combatants: [
            {
              id: "z",
              init: 12,
              qty: 4,
              name: "Zombie",
              isPC: false,
              maxHp: 22,
              units: [],
              loot: [],
              currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
              notes: "",
            },
          ],
        },
      ],
    });
    const b = {
      session: "S3",
      encounters: [
        {
          name: "flooded nave",
          tactics: "From the doc",
          morale: "Never breaks",
          setting: "A flooded chapel, water to the knees, candles still burning.",
          groups: [
            { monster: "Zombie", count: 6 },
            { monster: "Ghoul", count: 1 },
          ],
        },
      ],
    };
    const p = await call("import_session", b);
    expect(p.json.headline).toMatch(/1 updated/);
    await call("import_session", { ...b, confirm: true, planId: p.json.planId });
    const e = encounters()[0]!;
    expect(encounters()).toHaveLength(1);
    expect(e.id).toBe("hand");
    expect(e.tactics).toBe("My own tactics");
    expect(e.morale).toBe("Never breaks");
    expect(e.setting).toBe("A flooded chapel, water to the knees, candles still burning.");
    expect(e.combatants.map((c: J) => [c.name, c.qty])).toEqual([
      ["Zombie", 4],
      ["Ghoul", 1],
    ]);
    expect(e.combatants[0].init).toBe(12);
  });

  it("asks before treating a similar name as the same NPC, and never saves while a question is open", async () => {
    const b = { session: "S", npcs: [{ name: "Captain", description: "Second mention" }] };
    const p = await call("import_session", b);
    expect(p.json.questions).toMatchObject([
      { kind: "npc", proposed: "Captain", existing: "Brother-Captain" },
    ]);
    const before = readFileSync(file(), "utf8");
    expect(
      (await call("import_session", { ...b, confirm: true, planId: p.json.planId })).isError,
    ).toBe(true);
    expect(readFileSync(file(), "utf8")).toBe(before);

    const same = {
      session: "S",
      npcs: [{ name: "Brother-Captain", aliases: ["the Captain"], description: "Carries a horn" }],
    };
    const p2 = await call("import_session", same);
    expect(p2.json.questions).toEqual([]);
    await call("import_session", { ...same, confirm: true, planId: p2.json.planId });
    const npc = characters().filter((c) => c.role === "npc");
    expect(npc).toHaveLength(1);
    expect(npc[0]).toMatchObject({ aliases: ["the Captain"] });
    expect(npc[0]!.notes).toBe("Leads the zealots\nCarries a horn");

    const diff = { session: "S", npcs: [{ name: "Captain", distinct: true }] };
    const p3 = await call("import_session", diff);
    expect(p3.json.questions).toEqual([]);
  });

  it("imports a creature that is not in the library by name and says so", async () => {
    const b = {
      session: "S",
      encounters: [
        { name: "Odd", groups: [{ monster: "Zzyzx Beast", count: 2, overrides: { hp: 30 } }] },
      ],
    };
    const p = await call("import_session", b);
    expect(p.json.gaps[0]).toMatch(/"Zzyzx Beast".*not in the library/);
    await call("import_session", { ...b, confirm: true, planId: p.json.planId });
    const c = enc("Odd").combatants[0];
    expect(c).toMatchObject({ name: "Zzyzx Beast", qty: 2, maxHp: 30 });
    expect(c.stats).toBeUndefined();
  });

  it("links a carried-over encounter from an earlier session instead of rebuilding it", async () => {
    const first = {
      session: "S2",
      encounters: [
        {
          name: "The Chalice Herd",
          status: "dormant" as const,
          trigger: "If someone takes the cup",
          groups: [{ monster: "Zombie", count: 5 }],
        },
      ],
    };
    const p = await call("import_session", first);
    await call("import_session", { ...first, confirm: true, planId: p.json.planId });
    const next = {
      session: "S3",
      encounters: [{ name: "Chalice herd", groups: [{ monster: "Zombie", count: 5 }] }],
    };
    const p2 = await call("import_session", next);
    expect(p2.json.headline).toMatch(/0 new/);
    await call("import_session", { ...next, confirm: true, planId: p2.json.planId });
    expect(encounters()).toHaveLength(1);
    expect(encounters()[0]).toMatchObject({ session: "S2", status: "dormant" });
  });

  it("refuses to write on the original single-campaign layout", async () => {
    writeFileSync(file(), JSON.stringify({ version: 1, keys: { "dm-encounters-v1": [] } }));
    const r = await call("import_session", bundle);
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Open the Encounter Tracker app once/);
  });
});

describe("small edits", () => {
  let call: Awaited<ReturnType<typeof connect>>;
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "write-"));
    seed();
    call = await connect();
    const p = await call("import_session", bundle);
    await call("import_session", { ...bundle, confirm: true, planId: p.json.planId });
  });

  it("update_encounter changes a count and a trigger", async () => {
    const r = await call("update_encounter", {
      encounter: "orveth",
      status: "staged",
      setting: "A stone landing above the nave.",
      groups: [{ name: "Orveth", count: 2 }],
    });
    expect(r.json.changes).toEqual([
      "status → staged",
      "setting → A stone landing above the nave.",
      "Orveth: 1 → 2",
    ]);
    expect(enc("The Orveth")).toMatchObject({
      status: "staged",
      setting: "A stone landing above the nave.",
    });
    expect(enc("The Orveth").combatants[0]).toMatchObject({ qty: 2 });
    expect(enc("The Orveth").combatants[0].units).toHaveLength(2);
    expect((await call("update_encounter", { encounter: "nope" })).isError).toBe(true);
  });

  it("add_loot goes to a carrier or the room, and skips what is already there", async () => {
    const carried = await call("add_loot", {
      encounter: "Congregation",
      carriedBy: "Hezzix",
      loot: [{ name: "Holy symbol" }, { name: "Necklace of Adaptation" }],
    });
    expect(carried.json).toMatchObject({
      added: ["Holy symbol"],
      alreadyThere: ["Necklace of Adaptation"],
      where: "carried by Hezzix the Devoted",
    });
    const room = await call("add_loot", { encounter: "Smuggler", loot: [{ name: "Journal" }] });
    expect(room.json.where).toBe("in the room");
    expect(enc("Smuggler's Passage").roomLoot.map((l: J) => l.name)).toEqual([
      "Onyx stones ×6",
      "Journal",
    ]);
  });

  it("upsert_npc adds an alias to a matching NPC and asks on a similar one", async () => {
    const r = await call("upsert_npc", { name: "Hezzix", aliases: ["the Devoted"] });
    expect(r.json.saved).toBe(true);
    expect(characters().find((c) => c.name === "Hezzix")!.aliases).toEqual(["the Devoted"]);
    const q = await call("upsert_npc", { name: "Captain" });
    expect(q.json.saved).toBe(false);
  });

  it("upsert_npc saves the sheet, slots and a spellbook list", async () => {
    const r = await call("upsert_npc", {
      name: "Ilsabet Thorne",
      race: "Human",
      classes: "Wizard 5",
      ac: 12,
      maxHp: 32,
      abilities: [8, 14, 14, 17, 12, 10],
      spellAbility: "Intelligence",
      spellDc: 15,
      prepared: ["Shield", "Fireball"],
      slots: [
        { level: 1, count: 4 },
        { level: 3, count: 2 },
      ],
      spellbook: ["Fireball", "Shield", "Made Up Spell"],
    });
    expect(r.json.saved).toBe(true);
    expect(r.json.notInSrd).toEqual(["Made Up Spell"]);
    const npc = characters().find((c) => c.name === "Ilsabet Thorne")!;
    expect(npc.maxHp).toBe(32);
    expect(npc.slots.map((s: J) => [s.level, s.max, s.current])).toEqual([
      [1, 4, 4],
      [3, 2, 2],
    ]);
    expect(npc.prepared).toEqual(["Shield", "Fireball"]);
    const list = keys()["dm-c-c1-spell-lists"][0];
    expect(list.name).toBe("Ilsabet Thorne's spellbook");
    expect(list.spellIds).toHaveLength(2);
  });

  it("upsert_pc uploads a player sheet, then updates it without resetting spent slots", async () => {
    const sheet = {
      name: "Brannoch",
      race: "Dwarf",
      classes: "Cleric 5",
      ac: 18,
      maxHp: 41,
      slots: [{ level: 1, count: 4 }],
      resources: [{ name: "Channel Divinity", max: 1, reset: "short" }],
      gear: [{ name: "Warhammer", note: "+1" }],
    };
    const r = await call("upsert_pc", sheet);
    expect(r.json.saved).toBe(true);
    const pc = () => characters().find((c) => c.name === "Brannoch")!;
    expect(pc().role).toBe("pc");
    expect(pc().resources[0].reset).toBe("short");
    expect(pc().gear[0].name).toBe("Warhammer");
    expect(pc().firstAppearance).toBeUndefined();
    const again = await call("upsert_pc", { name: "Brannoch", ac: 19 });
    expect(again.json.result[0].action).toBe("update");
    expect(pc().ac).toBe(19);
    expect(pc().maxHp).toBe(41);
    expect(characters().filter((c) => c.name === "Brannoch")).toHaveLength(1);
  });

  it("list_sessions summarizes what is loaded", async () => {
    const r = await call("list_sessions");
    expect(r.json.sessions).toEqual([
      {
        session: "Winwoods S1 — Homecoming",
        encounters: 3,
        dormant: 1,
        creatureGroups: 4,
        loot: 6,
      },
    ]);
  });
});
