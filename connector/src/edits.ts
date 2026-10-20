import { makeUnits, type Combatant, type Encounter } from "@/lib/encounters";
import type { MagicItem } from "@/lib/equipment";
import { addLootToCombatant, addRoomLoot } from "./importer.js";
import { matchScore } from "./matching.js";
import type { CampaignView } from "./model.js";
import type { LootInput } from "./schema.js";

const isExact = (q: string, x: { name: string; aliases?: string[] | undefined }) =>
  [x.name, ...(x.aliases ?? [])].some((n) => matchScore(q, n) === 3);
const isSimilar = (q: string, x: { name: string; aliases?: string[] | undefined }) =>
  [x.name, ...(x.aliases ?? [])].some((n) => matchScore(q, n) >= 2 || matchScore(n, q) >= 2);

function pickOne<T extends { name: string; aliases?: string[] | undefined }>(
  list: T[],
  query: string,
  what: string,
): T {
  const exact = list.filter((x) => isExact(query, x));
  if (exact.length === 1) return exact[0]!;
  const pool = exact.length ? exact : list.filter((x) => isSimilar(query, x));
  if (pool.length === 1) return pool[0]!;
  if (pool.length === 0) throw new Error(`No ${what} matches "${query}".`);
  throw new Error(
    `"${query}" matches several ${what}s: ${pool.map((x) => x.name).join(", ")}. Use the exact name.`,
  );
}

export type EncounterEdit = {
  encounter: string;
  name?: string | undefined;
  location?: string | undefined;
  status?: "staged" | "dormant" | undefined;
  trigger?: string | undefined;
  tactics?: string | undefined;
  morale?: string | undefined;
  setting?: string | undefined;
  beats?: { round: number | string; text: string }[] | undefined;
  groups?:
    | {
        name: string;
        count?: number | undefined;
        countNote?: string | undefined;
        joins?: "start" | "manual" | number | undefined;
      }[]
    | undefined;
};

/** Edits one prepared encounter in place. Returns what changed. */
export function editEncounter(campaign: CampaignView, edit: EncounterEdit) {
  const encounters = structuredClone(campaign.encounters);
  const enc = pickOne(encounters, edit.encounter, "encounter");
  const changes: string[] = [];
  const set = <
    K extends "name" | "location" | "trigger" | "tactics" | "morale" | "setting" | "status",
  >(
    key: K,
  ) => {
    const value = edit[key];
    if (value !== undefined && enc[key] !== value) {
      (enc as Record<string, unknown>)[key] = value;
      changes.push(`${key} → ${value}`);
    }
  };
  (["name", "location", "status", "trigger", "tactics", "morale", "setting"] as const).forEach(set);
  if (edit.beats) {
    enc.beats = edit.beats;
    changes.push(`round beats replaced (${edit.beats.length})`);
  }
  for (const g of edit.groups ?? []) {
    const idx = enc.combatants.findIndex(
      (c) => c.id === pickOne(enc.combatants, g.name, "creature group").id,
    );
    const c: Combatant = { ...enc.combatants[idx]! };
    if (g.count !== undefined && g.count !== c.units.length) {
      const before = c.units.length;
      c.units =
        g.count > before
          ? [...c.units, ...makeUnits(g.count - before, c.maxHp)]
          : c.units.slice(0, g.count);
      c.qty = c.units.length;
      changes.push(`${c.name}: ${before} → ${c.units.length}`);
    }
    if (g.countNote !== undefined) c.countNote = g.countNote;
    if (g.joins !== undefined) {
      c.joins = g.joins;
      changes.push(`${c.name}: joins ${g.joins}`);
    }
    enc.combatants[idx] = c;
  }
  return { encounters, encounter: enc.name, changes };
}

/** Adds loot to a creature group, or to the room when no carrier is named. */
export function addLoot(
  campaign: CampaignView,
  args: { encounter: string; carriedBy?: string | undefined; loot: LootInput[] },
  magic: MagicItem[],
) {
  const encounters = structuredClone(campaign.encounters);
  const enc = pickOne(encounters, args.encounter, "encounter");
  if (args.carriedBy) {
    const idx = enc.combatants.findIndex(
      (c) => c.id === pickOne(enc.combatants, args.carriedBy!, "creature group").id,
    );
    const r = addLootToCombatant(enc.combatants[idx]!, args.loot, magic);
    enc.combatants[idx] = r.combatant;
    return {
      encounters,
      encounter: enc.name,
      where: `carried by ${r.combatant.name}`,
      added: r.added,
      skipped: r.skipped,
    };
  }
  const r = addRoomLoot(enc, args.loot, magic);
  return {
    encounters,
    encounter: enc.name,
    where: "in the room",
    added: r.added,
    skipped: r.skipped,
  };
}

export function listSessions(campaign: CampaignView) {
  const bySession = new Map<string, Encounter[]>();
  for (const e of campaign.encounters) {
    const key = e.session?.trim() || "(no session)";
    bySession.set(key, [...(bySession.get(key) ?? []), e]);
  }
  return [...bySession].map(([session, list]) => ({
    session,
    encounters: list.length,
    dormant: list.filter((e) => e.status === "dormant").length,
    creatureGroups: list.reduce((n, e) => n + e.combatants.filter((c) => !c.isPC).length, 0),
    loot: list.reduce(
      (n, e) =>
        n +
        (e.roomLoot?.length ?? 0) +
        e.combatants.reduce((m, c) => m + c.loot.filter((l) => !l.native).length, 0),
      0,
    ),
  }));
}
