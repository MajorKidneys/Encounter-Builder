import { bestScore, rank } from "./matching.js";
import type { LibraryMonster } from "@/lib/monsters";
import { buildTree, encounterParent, folderPath, type TreeNode } from "@/lib/folders";
import { pickCampaign, type CampaignView, type Encounter } from "./model.js";

const LIMIT = 15;

/** Level guessed from a class string like "Fighter 5 / Wizard 2"; null when none is written. */
function levelOf(classes: string | undefined): number | null {
  const nums = [...(classes ?? "").matchAll(/\b(\d{1,2})\b/g)].map((m) => Number(m[1]));
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

export function getParty(campaigns: CampaignView[], campaign?: string) {
  const c = pickCampaign(campaigns, campaign);
  const roster = c.characters.filter((ch) => ch.role === "pc");
  if (roster.length > 0) {
    return {
      campaign: c.name,
      source: "party roster",
      count: roster.length,
      party: roster.map((ch) => ({
        id: ch.id,
        name: ch.name,
        race: ch.race || null,
        classes: ch.classes || null,
        level: levelOf(ch.classes),
        ac: ch.ac ?? null,
        maxHp: ch.maxHp ?? null,
      })),
    };
  }
  // No saved roster: fall back to the player characters used in this campaign's encounters.
  const seen = new Map<string, { name: string; maxHp: number | null; encounters: string[] }>();
  for (const e of c.encounters) {
    for (const cb of e.combatants) {
      if (!cb.isPC) continue;
      const key = cb.name.trim().toLowerCase();
      const entry = seen.get(key) ?? { name: cb.name, maxHp: cb.maxHp ?? null, encounters: [] };
      entry.encounters.push(e.name);
      seen.set(key, entry);
    }
  }
  return {
    campaign: c.name,
    source: "player characters found in encounters (no saved party roster)",
    count: seen.size,
    party: [...seen.values()].map((p) => ({
      name: p.name,
      maxHp: p.maxHp,
      level: null,
      usedInEncounters: p.encounters,
    })),
  };
}

export function findNpc(campaigns: CampaignView[], name: string, campaign?: string) {
  const c = pickCampaign(campaigns, campaign);
  const npcs = c.characters.filter((ch) => ch.role === "npc");
  const matches = rank(npcs, (n) => bestScore(name, [n.name]), LIMIT).map((n) => ({
    id: n.id,
    name: n.name,
    race: n.race || null,
    classes: n.classes || null,
    notes: n.notes || null,
  }));
  return {
    campaign: c.name,
    matches,
    note:
      npcs.length === 0 ? "This campaign has no saved NPCs yet, so nothing can match." : undefined,
  };
}

const folderOf = (c: CampaignView, e: Encounter) =>
  folderPath(c.folders, encounterParent(c.folders, e)) || null;

export function findEncounter(campaigns: CampaignView[], name: string, campaign?: string) {
  const c = pickCampaign(campaigns, campaign);
  const matches = rank(
    c.encounters,
    (e) => bestScore(name, [e.name, ...(e.aliases ?? [])]),
    LIMIT,
  ).map((e) => ({
    id: e.id,
    name: e.name,
    aliases: e.aliases ?? [],
    folder: folderOf(c, e),
    session: e.session || null,
    location: e.location || null,
    status: e.status ?? null,
    archived: Boolean(e.archived),
    round: e.round && e.round > 0 ? e.round : null,
    setting: e.setting || null,
    trigger: e.trigger || null,
    tactics: e.tactics || null,
    morale: e.morale || null,
    beats: e.beats ?? [],
    roomLoot: (e.roomLoot ?? []).map((l) => ({
      name: l.name,
      condition: l.condition ?? null,
      value: l.value ?? null,
      taken: Boolean(l.taken),
    })),
    combatants: e.combatants.map((cb) => ({
      name: cb.name,
      qty: cb.qty ?? 1,
      isPC: Boolean(cb.isPC),
      maxHp: cb.maxHp ?? null,
      lootItems: cb.loot?.length ?? 0,
    })),
  }));
  return { campaign: c.name, totalEncounters: c.encounters.length, matches };
}

type Outline = { folder: string; id: string; items: Outline[] } | OutlineEncounter;
type OutlineEncounter = {
  encounter: string;
  id: string;
  session: string | null;
  location: string | null;
  status: string | null;
  archived: boolean;
  hasSetting: boolean;
};

/** Every encounter, laid out the way the sidebar shows them: folders nested, in sidebar order. */
export function listEncounters(campaigns: CampaignView[], campaign?: string) {
  const c = pickCampaign(campaigns, campaign);
  const walk = (nodes: TreeNode[]): Outline[] =>
    nodes.map((n) =>
      n.type === "folder"
        ? { folder: n.folder.name, id: n.folder.id, items: walk(n.children) }
        : {
            encounter: n.encounter.name,
            id: n.encounter.id,
            session: n.encounter.session || null,
            location: n.encounter.location || null,
            status: n.encounter.status ?? null,
            archived: Boolean(n.encounter.archived),
            hasSetting: Boolean(n.encounter.setting),
          },
    );
  return {
    campaign: c.name,
    totalEncounters: c.encounters.length,
    totalFolders: c.folders.length,
    outline: walk(buildTree({ folders: c.folders, encounters: c.encounters })),
  };
}

export function findLoot(campaigns: CampaignView[], name: string, campaign?: string) {
  const c = pickCampaign(campaigns, campaign);
  const rows = c.encounters.flatMap((e) =>
    e.combatants.flatMap((cb) =>
      (cb.loot ?? []).map((item) => ({
        item: item.name,
        taken: Boolean(item.taken),
        description: item.desc || null,
        carriedBy: cb.name,
        encounter: e.name,
        encounterId: e.id,
      })),
    ),
  );
  return { campaign: c.name, matches: rank(rows, (r) => bestScore(name, [r.item]), LIMIT * 2) };
}

type MonsterHit = {
  name: string;
  source: string;
  id?: string;
  meta?: string;
  cr?: number;
  ac?: number;
  hp?: number;
  hitDice?: string;
  usedIn?: string[];
};

export function findMonster(
  library: LibraryMonster[],
  campaigns: CampaignView[],
  name: string,
  source: "all" | "library" | "custom" = "all",
) {
  const hits: MonsterHit[] = [];
  if (source !== "custom") {
    for (const m of rank(library, (x) => bestScore(name, [x.name]), LIMIT)) {
      hits.push({
        name: m.name,
        source: m.source ?? (m.srd === false ? "Library" : "SRD 5.1"),
        id: m.id,
        meta: m.meta,
        cr: m.cr,
        ac: m.ac,
        hp: m.hp,
        hitDice: m.hitDice,
      });
    }
  }
  if (source !== "library") {
    // Stat blocks built by hand in an encounter (not copied from the library).
    const custom = new Map<string, MonsterHit>();
    for (const c of campaigns) {
      for (const e of c.encounters) {
        for (const cb of e.combatants) {
          const s = cb.stats;
          if (!s || cb.isPC || s.srdId) continue;
          const key = (s.name ?? cb.name).toLowerCase();
          const hit = custom.get(key) ?? {
            name: s.name ?? cb.name,
            source: "custom (built in an encounter)",
            meta: s.meta,
            cr: s.cr,
            ac: s.ac,
            hp: s.hp,
            hitDice: s.hitDice,
            usedIn: [],
          };
          hit.usedIn!.push(`${c.name} / ${e.name}`);
          custom.set(key, hit);
        }
      }
    }
    hits.push(...rank([...custom.values()], (h) => bestScore(name, [h.name]), LIMIT));
  }
  return { matches: hits };
}
