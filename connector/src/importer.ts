import { makeCharacter } from "@/lib/characters";
import { makeUnits, uid, type Combatant, type Encounter, type LootItem } from "@/lib/encounters";
import {
  changeLoot,
  combatantFromLibrary,
  gearItem,
  magicLoot,
  type MagicItem,
} from "@/lib/equipment";
import { blankStats, type Feature, type LibraryMonster, type MonsterStats } from "@/lib/monsters";
import { matchScore } from "./matching.js";
import type { CampaignView, Character } from "./model.js";
import type {
  Bundle,
  CustomMonster,
  EncounterInput,
  GroupInput,
  LootInput,
  NpcInput,
} from "./schema.js";

export type Ctx = { library: LibraryMonster[]; magic: MagicItem[] };
export type PlanItem = {
  kind: "encounter" | "npc" | "group";
  action: "create" | "reuse" | "update" | "skip";
  name: string;
  detail?: string | undefined;
};
export type Uncertain = {
  kind: "encounter" | "npc";
  proposed: string;
  existing: string;
  question: string;
};
export type Plan = {
  encounters: Encounter[];
  characters: Character[];
  items: PlanItem[];
  gaps: string[];
  uncertain: Uncertain[];
  headline: string;
};

const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const zero = () => ({ cp: 0, sp: 0, gp: 0, pp: 0 });
const namesOf = (x: { name: string; aliases?: string[] | undefined }) => [
  x.name,
  ...(x.aliases ?? []),
];
const isExact = (query: string, x: { name: string; aliases?: string[] | undefined }) =>
  namesOf(x).some((n) => matchScore(query, n) === 3);
/** One name is a partial form of the other ("the Captain" / "Brother-Captain"). */
const isSimilar = (query: string, x: { name: string; aliases?: string[] | undefined }) =>
  namesOf(x).some((n) => matchScore(query, n) === 2 || matchScore(n, query) === 2);
const stripQty = (name: string) => name.replace(/\s*×\d+$/, "");
const union = (a: string[] | undefined, b: string[] | undefined) => {
  const out = [...(a ?? [])];
  for (const x of b ?? []) if (!out.some((y) => matchScore(x, y) === 3)) out.push(x);
  return out;
};

// ---------- loot ----------

export function lootFromInput(l: LootInput, magic: MagicItem[]): LootItem {
  const m = magic.find((x) => matchScore(l.name, x.name) === 3);
  const base = m ? magicLoot(m) : gearItem(l.name);
  const qty = l.quantity && l.quantity > 1 ? ` ×${l.quantity}` : "";
  const desc = [base.desc, l.description].filter(Boolean).join("\n");
  return clean({
    ...base,
    name: base.name + qty,
    ...(desc ? { desc } : {}),
    ...(l.condition ? { condition: l.condition } : {}),
    ...(l.harvest ? { harvest: l.harvest } : {}),
    ...(l.value ? { value: l.value } : {}),
  });
}

/** Adds loot a carrier does not already have. Gear stats are re-synced the way the app does it. */
export function addLootToCombatant(c: Combatant, inputs: LootInput[], magic: MagicItem[]) {
  const added: string[] = [];
  const skipped: string[] = [];
  let loot = c.loot;
  for (const l of inputs) {
    if (loot.some((x) => matchScore(l.name, stripQty(x.name)) === 3)) {
      skipped.push(l.name);
      continue;
    }
    loot = [...loot, lootFromInput(l, magic)];
    added.push(l.name);
  }
  return { combatant: added.length ? changeLoot(c, loot) : c, added, skipped };
}

export function addRoomLoot(e: Encounter, inputs: LootInput[], magic: MagicItem[]) {
  const added: string[] = [];
  const skipped: string[] = [];
  for (const l of inputs) {
    if ((e.roomLoot ?? []).some((x) => matchScore(l.name, stripQty(x.name)) === 3))
      skipped.push(l.name);
    else {
      e.roomLoot = [...(e.roomLoot ?? []), lootFromInput(l, magic)];
      added.push(l.name);
    }
  }
  return { added, skipped };
}

// ---------- monsters ----------

function customStats(c: CustomMonster): MonsterStats {
  const s = blankStats(c.name);
  const f = (list: CustomMonster["traits"]): Feature[] => clean(list ?? []);
  return {
    ...s,
    meta: c.meta ?? "",
    ac: c.ac,
    acNote: c.acNote ?? "",
    hp: c.hp,
    hitDice: c.hitDice ?? "",
    speed: c.speed ?? s.speed,
    abilities: c.abilities ?? s.abilities,
    saves: c.saves ?? "",
    skills: c.skills ?? "",
    senses: c.senses ?? "",
    languages: c.languages ?? "",
    cr: c.cr ?? 0,
    resist: c.resist ?? "",
    immune: c.immune ?? "",
    vuln: c.vuln ?? "",
    condImmune: c.condImmune ?? "",
    special: f(c.traits),
    actions: f(c.actions),
    reactions: f(c.reactions),
    legendary: f(c.legendary),
  };
}

export function resolveMonster(library: LibraryMonster[], name: string) {
  const exact = library.filter((m) => matchScore(name, m.name) === 3);
  const monster = exact.find((m) => m.srd !== false) ?? exact[0];
  const closest = monster
    ? []
    : library
        .filter((m) => isSimilar(name, m))
        .slice(0, 4)
        .map((m) => m.name);
  return { monster, closest };
}

const baseCombatant = (name: string, hp: number | null): Combatant => ({
  id: uid(),
  init: null,
  qty: 1,
  name,
  isPC: false,
  maxHp: hp,
  units: makeUnits(1, hp),
  loot: [],
  currency: zero(),
  notes: "",
});

function buildGroup(
  g: GroupInput,
  ctx: Ctx,
  npc: Character | undefined,
  gaps: string[],
  where: string,
) {
  let c: Combatant;
  if (g.custom) {
    const stats = customStats(g.custom);
    c = { ...baseCombatant(g.custom.name, stats.hp), stats };
  } else {
    const { monster, closest } = resolveMonster(ctx.library, g.monster!);
    if (monster) c = combatantFromLibrary(monster);
    else {
      c = baseCombatant(g.monster!, g.overrides?.hp ?? null);
      gaps.push(
        `"${g.monster}" (${where}) is not in the library${closest.length ? ` (closest: ${closest.join(", ")})` : ""}, so it was added by name with no stat block.`,
      );
    }
  }
  const o = g.overrides ?? {};
  if (c.stats) {
    const stats = { ...c.stats };
    if (o.hp !== undefined) stats.hp = o.hp;
    if (o.hitDice !== undefined) stats.hitDice = o.hitDice;
    if (o.ac !== undefined) stats.ac = o.ac;
    if (o.acNote !== undefined) stats.acNote = o.acNote;
    if (o.speed !== undefined) stats.speed = o.speed;
    if (o.cr !== undefined) stats.cr = o.cr;
    c = { ...c, stats, maxHp: o.hp !== undefined ? o.hp : c.maxHp };
  }
  c = {
    ...c,
    ...(g.name ? { name: g.name } : {}),
    qty: g.count,
    units: makeUnits(g.count, c.maxHp),
    ...(g.countNote ? { countNote: g.countNote } : {}),
    ...(g.joins !== undefined ? { joins: g.joins } : {}),
    ...(npc ? { npcId: npc.id } : {}),
    ...(g.notes ? { notes: g.notes } : {}),
  };
  if (g.loot?.length) c = addLootToCombatant(c, g.loot, ctx.magic).combatant;
  return c;
}

// ---------- NPCs ----------

/** Finds, updates or creates an NPC. Returns undefined when the match is uncertain and needs the GM. */
export function upsertNpc(
  characters: Character[],
  n: NpcInput,
  session: string,
  items: PlanItem[],
  uncertain: Uncertain[],
): Character | undefined {
  const npcs = characters.filter((c) => c.role === "npc");
  const exact = npcs.find((c) => isExact(n.name, c));
  const similar = !exact && !n.distinct ? npcs.find((c) => isSimilar(n.name, c)) : undefined;
  if (similar) {
    uncertain.push({
      kind: "npc",
      proposed: n.name,
      existing: similar.name,
      question: `Is "${n.name}" the same person as the existing NPC "${similar.name}"? If yes, use that exact name; if not, send it again with distinct: true.`,
    });
    return undefined;
  }
  const note = [n.description, n.notes].filter(Boolean).join("\n");
  if (exact) {
    const changed: string[] = [];
    const aliases = union(exact.aliases, [
      ...(n.aliases ?? []),
      ...(matchScore(n.name, exact.name) === 3 ? [] : [n.name]),
    ]);
    if (aliases.length !== (exact.aliases ?? []).length) {
      exact.aliases = aliases;
      changed.push("aliases");
    }
    if (note && !exact.notes.includes(note)) {
      exact.notes = exact.notes ? `${exact.notes}\n${note}` : note;
      changed.push("notes");
    }
    if (n.firstAppearance && !exact.firstAppearance) {
      exact.firstAppearance = n.firstAppearance;
      changed.push("first appearance");
    }
    if (n.race && !exact.race) exact.race = n.race;
    if (n.classes && !exact.classes) exact.classes = n.classes;
    items.push({
      kind: "npc",
      action: changed.length ? "update" : "reuse",
      name: exact.name,
      detail: changed.length ? `added ${changed.join(", ")}` : "already on the NPC list",
    });
    return exact;
  }
  const created: Character = {
    ...makeCharacter("npc", n.name),
    race: n.race ?? "",
    classes: n.classes ?? "",
    notes: note,
    ...(n.aliases?.length ? { aliases: n.aliases } : {}),
    firstAppearance: n.firstAppearance ?? session,
  };
  characters.push(created);
  items.push({ kind: "npc", action: "create", name: n.name, detail: n.description });
  return created;
}

// ---------- the whole import ----------

export function planImport(campaign: CampaignView, bundle: Bundle, ctx: Ctx): Plan {
  const encounters = structuredClone(campaign.encounters);
  const characters = structuredClone(campaign.characters);
  const items: PlanItem[] = [];
  const gaps: string[] = [];
  const uncertain: Uncertain[] = [];
  let lootCreatureAdded = 0;
  let lootRoomAdded = 0;
  let lootSkipped = 0;
  let customMonsters = 0;

  for (const n of bundle.npcs) upsertNpc(characters, n, bundle.session, items, uncertain);

  for (const e of bundle.encounters) {
    const sameKey = (x: Encounter) =>
      !!e.location &&
      x.session === bundle.session &&
      !!x.location &&
      matchScore(e.location, x.location) === 3;
    let hit = encounters.find((x) => isExact(e.name, x)) ?? encounters.find(sameKey);
    if (!hit && !e.distinct) {
      const similar = encounters.find((x) => isSimilar(e.name, x));
      if (similar) {
        uncertain.push({
          kind: "encounter",
          proposed: e.name,
          existing: similar.name,
          question: `Is "${e.name}" the same encounter as the existing "${similar.name}"? If yes, use that exact name; if not, send it again with distinct: true.`,
        });
        continue;
      }
    }
    const isNew = !hit;
    const enc: Encounter = hit ?? {
      id: uid(),
      name: e.name,
      archived: false,
      createdAt: Date.now(),
      combatants: [],
      session: bundle.session,
      status: e.status ?? "staged",
    };
    if (isNew) encounters.push(enc);

    const filled: string[] = [];
    const fill = <K extends "location" | "trigger" | "tactics" | "morale">(key: K) => {
      if (e[key] && !enc[key]) {
        enc[key] = e[key];
        filled.push(key);
      }
    };
    (["location", "trigger", "tactics", "morale"] as const).forEach(fill);
    if (!enc.session) enc.session = bundle.session;
    if (e.status && !enc.status) enc.status = e.status;
    if (e.beats?.length && !enc.beats?.length) {
      enc.beats = clean(e.beats);
      filled.push("round beats");
    }
    const aliases = union(enc.aliases, e.aliases);
    if (aliases.length) enc.aliases = aliases;

    let groupsNew = 0;
    let groupsSkipped = 0;
    const labels = new Map<string, number>();
    for (const input of e.groups) {
      // Several waves of the same creature in one encounter stay separate: "Lizardfolk", "Lizardfolk 2".
      const base = input.name ?? input.monster ?? input.custom!.name;
      const seen = (labels.get(base.toLowerCase()) ?? 0) + 1;
      labels.set(base.toLowerCase(), seen);
      const label = seen > 1 ? `${base} ${seen}` : base;
      const g = label === base ? input : { ...input, name: label };
      const npc = g.npc
        ? (upsertNpc(characters, { name: g.npc, distinct: true }, bundle.session, [], uncertain) ??
          undefined)
        : undefined;
      const existing = enc.combatants.find((c) => matchScore(label, c.name) === 3);
      if (existing) {
        if (g.loot?.length) {
          const r = addLootToCombatant(existing, g.loot, ctx.magic);
          enc.combatants = enc.combatants.map((c) => (c.id === existing.id ? r.combatant : c));
          lootCreatureAdded += r.added.length;
          lootSkipped += r.skipped.length;
        }
        groupsSkipped++;
        continue;
      }
      const c = buildGroup(g, ctx, npc, gaps, enc.name);
      enc.combatants.push(c);
      groupsNew++;
      if (g.custom) customMonsters++;
      lootCreatureAdded += g.loot?.length ?? 0;
      items.push({
        kind: "group",
        action: "create",
        name: `${g.count}× ${c.name}`,
        detail:
          [g.countNote, g.joins && g.joins !== "start" ? `joins ${g.joins}` : ""]
            .filter(Boolean)
            .join("; ") || enc.name,
      });
    }
    if (e.loot?.length) {
      const r = addRoomLoot(enc, e.loot, ctx.magic);
      lootRoomAdded += r.added.length;
      lootSkipped += r.skipped.length;
    }
    const bits = [
      groupsNew ? `${groupsNew} group${groupsNew > 1 ? "s" : ""} added` : "",
      groupsSkipped ? `${groupsSkipped} already there` : "",
      filled.length ? `filled ${filled.join(", ")}` : "",
    ].filter(Boolean);
    const dormant = enc.status === "dormant" ? " (dormant)" : "";
    items.push({
      kind: "encounter",
      action: isNew
        ? "create"
        : bits.some((b) => !b.endsWith("already there"))
          ? "update"
          : "reuse",
      name: enc.name + dormant,
      detail: bits.join(", ") || "already in the tracker",
    });
  }

  const count = (kind: PlanItem["kind"], action: PlanItem["action"]) =>
    items.filter((i) => i.kind === kind && i.action === action).length;
  const dormantNew = bundle.encounters.filter((e) => e.status === "dormant").length;
  const headline = [
    `Encounters: ${count("encounter", "create")} new, ${count("encounter", "update")} updated, ${count("encounter", "reuse")} already there${dormantNew ? ` (${dormantNew} dormant in this import)` : ""}.`,
    `${count("group", "create")} creature groups${customMonsters ? `, ${customMonsters} with custom stat blocks` : ""}.`,
    `NPCs: ${count("npc", "create")} new, ${count("npc", "update") + count("npc", "reuse")} reused.`,
    `Loot: ${lootCreatureAdded + lootRoomAdded} new (${lootCreatureAdded} carried, ${lootRoomAdded} in rooms)${lootSkipped ? `, ${lootSkipped} already there` : ""}.`,
    gaps.length ? `${gaps.length} gap${gaps.length > 1 ? "s" : ""} to review.` : "",
    uncertain.length
      ? `${uncertain.length} match${uncertain.length > 1 ? "es need" : " needs"} the GM's decision.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { encounters, characters, items, gaps, uncertain, headline };
}
