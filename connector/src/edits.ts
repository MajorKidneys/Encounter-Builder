import { makeUnits, uid, type Combatant, type Encounter } from "@/lib/encounters";
import { encounterParent, ensureFolderPath, folderPath, moveToEnd, splitPath } from "@/lib/folders";
import type { MagicItem } from "@/lib/equipment";
import { addLootToCombatant, addRoomLoot, lootFromInput } from "./importer.js";
import { matchScore } from "./matching.js";
import type { CampaignView } from "./model.js";
import { LOCATION_MAX, type LootInput } from "./schema.js";

const stripQty = (name: string) => name.replace(/\s*×\d+$/, "");
const isExact = (q: string, x: { name: string; aliases?: string[] | undefined }) =>
  [x.name, ...(x.aliases ?? [])].some((n) => matchScore(q, n) === 3);
const isSimilar = (q: string, x: { name: string; aliases?: string[] | undefined }) =>
  [x.name, ...(x.aliases ?? [])].some((n) => matchScore(q, n) >= 2 || matchScore(n, q) >= 2);

function pickOne<T extends { name: string; aliases?: string[] | undefined }>(
  list: T[],
  query: string,
  what: string,
  describe: (x: T) => string = (x) => x.name,
): T {
  const exact = list.filter((x) => isExact(query, x));
  if (exact.length === 1) return exact[0]!;
  const pool = exact.length ? exact : list.filter((x) => isSimilar(query, x));
  if (pool.length === 1) return pool[0]!;
  if (pool.length === 0) throw new Error(`No ${what} matches "${query}".`);
  throw new Error(
    `"${query}" matches several ${what}s: ${pool.map(describe).join(", ")}. Use the exact name${what === "encounter" ? ', the id, or "Folder / Name"' : ""}.`,
  );
}

/** "Night 1 / River Fort" for the folder an encounter sits in, or "" at the top level. */
const pathOf = (campaign: CampaignView, e: Encounter) =>
  folderPath(campaign.folders, encounterParent(campaign.folders, e));

const label = (campaign: CampaignView, e: Encounter) => {
  const where = pathOf(campaign, e);
  return where ? `${where} / ${e.name}` : e.name;
};

/**
 * Finds one encounter by id, by "Folder / Name" path, or by name or alias. Several encounters can
 * share a name in different folders, so a bare name that fits more than one comes back as an
 * error that lists each with its path and id.
 */
export function pickEncounter(campaign: CampaignView, query: string): Encounter {
  const list = campaign.encounters;
  const byId = list.find((e) => e.id === query.trim());
  if (byId) return byId;
  const parts = splitPath(query);
  if (query.includes("/") && parts.length > 1) {
    const where = parts.slice(0, -1).join(" / ").toLowerCase();
    const scoped = list.filter((e) => pathOf(campaign, e).toLowerCase() === where);
    return pickOne(
      scoped,
      parts[parts.length - 1]!,
      "encounter",
      (e) => `${label(campaign, e)} (id ${e.id})`,
    );
  }
  return pickOne(list, query, "encounter", (e) => `${label(campaign, e)} (id ${e.id})`);
}

export type Clearable = string | null | undefined;

export type EncounterEdit = {
  encounter: string;
  name?: string | undefined;
  session?: Clearable;
  location?: Clearable;
  status?: "staged" | "dormant" | undefined;
  trigger?: Clearable;
  tactics?: Clearable;
  morale?: Clearable;
  setting?: Clearable;
  beats?: { round: number | string; text: string }[] | undefined;
  roomLoot?: LootInput[] | undefined;
  /** Folder path to move the encounter to. null or "" means the top level. */
  folder?: string | null | undefined;
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
export function editEncounter(
  campaign: CampaignView,
  edit: EncounterEdit,
  magic: MagicItem[] = [],
) {
  const encounters = structuredClone(campaign.encounters);
  const scoped = { ...campaign, encounters };
  const enc = pickEncounter(scoped, edit.encounter);
  let folders = structuredClone(campaign.folders);
  const changes: string[] = [];

  if (typeof edit.location === "string" && edit.location.length > LOCATION_MAX)
    throw new Error(
      `Location is a short room key (${LOCATION_MAX} characters or fewer). Put scene prose in setting.`,
    );

  if (edit.name !== undefined && edit.name !== enc.name) {
    changes.push(`name → ${edit.name}`);
    enc.name = edit.name;
  }
  if (edit.status !== undefined && edit.status !== enc.status) {
    enc.status = edit.status;
    changes.push(`status → ${edit.status}`);
  }
  // A value sets the field; null or an empty string clears it.
  for (const key of ["session", "location", "trigger", "tactics", "morale", "setting"] as const) {
    const value = edit[key];
    if (value === undefined) continue;
    const next = value === null || !value.trim() ? undefined : value;
    if (enc[key] === next) continue;
    if (next === undefined) delete enc[key];
    else enc[key] = next;
    changes.push(next === undefined ? `${key} cleared` : `${key} → ${next}`);
  }
  if (edit.beats) {
    if (edit.beats.length) enc.beats = edit.beats;
    else delete enc.beats;
    changes.push(`round beats replaced (${edit.beats.length})`);
  }
  if (edit.roomLoot) {
    const old = enc.roomLoot ?? [];
    const next = edit.roomLoot.map((l) => {
      const kept = old.find((x) => matchScore(l.name, stripQty(x.name)) === 3);
      if (!kept) return lootFromInput(l, magic);
      return { ...kept, ...(l.condition !== undefined ? { condition: l.condition } : {}) };
    });
    if (next.length) enc.roomLoot = next;
    else delete enc.roomLoot;
    changes.push(`room loot replaced (${next.length})`);
  }
  if (edit.folder !== undefined) {
    const path = edit.folder === null ? [] : splitPath(edit.folder);
    const made = ensureFolderPath({ folders, encounters }, path, uid);
    const here = encounterParent(made.state.folders, enc);
    if (here !== made.id) {
      const moved = moveToEnd(made.state, { kind: "encounter", id: enc.id }, made.id);
      folders = moved.folders;
      encounters.splice(0, encounters.length, ...moved.encounters);
      changes.push(`moved to ${path.length ? path.join(" / ") : "the top level"}`);
    } else folders = made.state.folders;
  }
  const live = encounters.find((e) => e.id === enc.id)!;
  for (const g of edit.groups ?? []) {
    const idx = live.combatants.findIndex(
      (c) => c.id === pickOne(live.combatants, g.name, "creature group").id,
    );
    const c: Combatant = { ...live.combatants[idx]! };
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
    live.combatants[idx] = c;
  }
  return { encounters, folders, encounter: live.name, changes };
}

/** Adds loot to a creature group, or to the room when no carrier is named. */
export function addLoot(
  campaign: CampaignView,
  args: { encounter: string; carriedBy?: string | undefined; loot: LootInput[] },
  magic: MagicItem[],
) {
  const encounters = structuredClone(campaign.encounters);
  const enc = pickEncounter({ ...campaign, encounters }, args.encounter);
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
