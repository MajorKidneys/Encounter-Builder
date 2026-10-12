import { makeUnits, uid, type Combatant, type Encounter } from "./encounters";
import { blankStats, type MonsterStats } from "./monsters";

export type CharacterRole = "pc" | "npc";
export type SlotKind = "spell" | "pact";

/** Remaining uses of one spell level. Pact slots refill on a short rest; spell slots wait for a long rest. */
export type CharacterSlot = {
  id: string;
  kind: SlotKind;
  level: number;
  max: number;
  current: number;
  /** A slot created above the sheet, such as with sorcery points. A long rest removes it. */
  temporary?: boolean;
};

/** A limited use that is not a spell slot. `reset` null means only a manual tick refills it. */
export type CharacterResource = {
  id: string;
  name: string;
  max: number;
  current: number;
  reset: "short" | "long" | null;
};

export type CharacterAttack = { id: string; name: string; attack: string; damage: string };
export type CharacterGear = { id: string; name: string; note: string };

/**
 * A PC or NPC saved on a campaign. Both use the same sheet: race, class, and level.
 * An encounter row is a copy. Spell slots and limited uses are the exception: ticking
 * them writes back here so the next fight starts where the session left off.
 */
export type Character = {
  id: string;
  role: CharacterRole;
  name: string;
  race: string;
  classes: string;
  ac: number | null;
  acNote: string;
  /** Reference maximum. Player rows in a fight do not spend this. NPC rows do. */
  maxHp: number | null;
  speed: string;
  abilities: Array<number | null>;
  saves: string;
  passive: number | null;
  senses: string;
  attacks: CharacterAttack[];
  spellAbility: string;
  spellDc: number | null;
  spellAttack: number | null;
  prepared: string[];
  slots: CharacterSlot[];
  resources: CharacterResource[];
  gear: CharacterGear[];
  notes: string;
};

const ABS = 6;

export function makeCharacter(role: CharacterRole, name = ""): Character {
  return {
    id: uid(),
    role,
    name: name || (role === "npc" ? "New NPC" : "New character"),
    race: "",
    classes: "",
    ac: null,
    acNote: "",
    maxHp: null,
    speed: "",
    abilities: Array.from({ length: ABS }, () => null),
    saves: "",
    passive: null,
    senses: "",
    attacks: [],
    spellAbility: "",
    spellDc: null,
    spellAttack: null,
    prepared: [],
    slots: [],
    resources: [],
    gear: [],
    notes: "",
  };
}

export function identity(c: Pick<Character, "race" | "classes">): string {
  const line = [c.race.trim(), c.classes.trim()].filter(Boolean).join(" · ");
  return line || "Race and class not on sheet";
}

/** Clicking pip `index` (0-based) fills through it, or empties it and everything after. */
export function pipValue(index: number, current: number): number {
  return index < current ? index : index + 1;
}

export function shortRest(c: Character): Character {
  return {
    ...c,
    slots: c.slots.map((s) => (s.kind === "pact" ? { ...s, current: s.max } : s)),
    resources: c.resources.map((r) => (r.reset === "short" ? { ...r, current: r.max } : r)),
  };
}

export function longRest(c: Character): Character {
  return {
    ...c,
    slots: c.slots.filter((s) => !s.temporary).map((s) => ({ ...s, current: s.max })),
    resources: c.resources.map((r) =>
      r.reset === "short" || r.reset === "long" ? { ...r, current: r.max } : r,
    ),
  };
}

export function grantSlots(c: Character, kind: SlotKind, level: number, count: number): Character {
  const n = Math.max(1, Math.min(9, Math.floor(level) || 1));
  const add = Math.max(1, Math.min(9, Math.floor(count) || 1));
  const hit = c.slots.find((s) => s.kind === kind && s.level === n && !s.temporary);
  if (!hit) {
    return { ...c, slots: [...c.slots, { id: uid(), kind, level: n, max: add, current: add }] };
  }
  return {
    ...c,
    slots: c.slots.map((s) =>
      s.id === hit.id ? { ...s, max: s.max + add, current: s.current + add } : s,
    ),
  };
}

export function addTemporarySlot(c: Character, level: number): Character {
  const n = Math.max(1, Math.min(5, Math.floor(level) || 1));
  return {
    ...c,
    slots: [
      ...c.slots,
      { id: uid(), kind: "spell", level: n, max: 1, current: 1, temporary: true },
    ],
  };
}

export function setSlotCurrent(c: Character, id: string, current: number): Character {
  return {
    ...c,
    slots: c.slots.map((s) =>
      s.id === id ? { ...s, current: Math.max(0, Math.min(s.max, current)) } : s,
    ),
  };
}

export function setResourceCurrent(c: Character, id: string, current: number): Character {
  return {
    ...c,
    resources: c.resources.map((r) =>
      r.id === id ? { ...r, current: Math.max(0, Math.min(r.max, current)) } : r,
    ),
  };
}

export function slotsInOrder(slots: CharacterSlot[]): CharacterSlot[] {
  return [...slots].sort(
    (a, b) =>
      Number(a.kind === "spell") - Number(b.kind === "spell") ||
      a.level - b.level ||
      Number(!!a.temporary) - Number(!!b.temporary),
  );
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Accepts the current sheet and the earlier name-and-HP records. */
export function coerceCharacter(value: unknown): Character | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Character> & { notes?: unknown };
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const base = makeCharacter(raw.role === "npc" ? "npc" : "pc", raw.name);
  const abilities = Array.isArray(raw.abilities)
    ? raw.abilities.slice(0, ABS).map(numOrNull)
    : base.abilities;
  while (abilities.length < ABS) abilities.push(null);
  return {
    ...base,
    id: raw.id,
    role: raw.role === "npc" ? "npc" : "pc",
    name: raw.name,
    race: typeof raw.race === "string" ? raw.race : "",
    classes: typeof raw.classes === "string" ? raw.classes : "",
    ac: numOrNull(raw.ac),
    acNote: typeof raw.acNote === "string" ? raw.acNote : "",
    maxHp: numOrNull(raw.maxHp),
    speed: typeof raw.speed === "string" ? raw.speed : "",
    abilities,
    saves: typeof raw.saves === "string" ? raw.saves : "",
    passive: numOrNull(raw.passive),
    senses: typeof raw.senses === "string" ? raw.senses : "",
    attacks: Array.isArray(raw.attacks)
      ? raw.attacks.filter((a) => a && typeof a.name === "string")
      : [],
    spellAbility: typeof raw.spellAbility === "string" ? raw.spellAbility : "",
    spellDc: numOrNull(raw.spellDc),
    spellAttack: numOrNull(raw.spellAttack),
    prepared: Array.isArray(raw.prepared) ? raw.prepared.filter((n) => typeof n === "string") : [],
    slots: Array.isArray(raw.slots) ? raw.slots.filter((s) => s && typeof s.id === "string") : [],
    resources: Array.isArray(raw.resources)
      ? raw.resources.filter((r) => r && typeof r.id === "string")
      : [],
    gear: Array.isArray(raw.gear) ? raw.gear.filter((g) => g && typeof g.name === "string") : [],
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

function attackBonus(text: string): number | undefined {
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : undefined;
}

export function statsFromCharacter(c: Character): MonsterStats {
  const stats = blankStats(c.name);
  stats.ac = c.ac ?? 10;
  stats.acNote =
    c.ac == null ? [c.acNote, "AC not on sheet"].filter(Boolean).join(" · ") : c.acNote;
  stats.hp = c.maxHp ?? 0;
  stats.speed = c.speed;
  stats.abilities = c.abilities.map((n) => n ?? 10);
  stats.saves = c.saves;
  stats.passive = c.passive ?? 10;
  stats.senses = c.senses;
  stats.meta = identity(c);
  stats.actions = c.attacks.map((a) => ({
    name: a.name,
    desc: a.damage,
    attack: attackBonus(a.attack),
    damage: a.damage,
  }));
  if (c.spellAbility || c.spellDc != null || c.spellAttack != null || c.prepared.length) {
    stats.spells = [
      {
        name: "Spellcasting",
        ability: c.spellAbility,
        dc: c.spellDc,
        attack: c.spellAttack,
        list: c.prepared
          .map((name) => name.trim())
          .filter(Boolean)
          .join(", "),
      },
    ];
  }
  return stats;
}

/** A fight row. Players keep their own hit points. NPCs use the saved maximum because the DM runs them. */
export function combatantFromCharacter(c: Character): Combatant {
  const player = c.role === "pc";
  const maxHp = player ? null : c.maxHp;
  return {
    id: uid(),
    characterId: c.id,
    init: null,
    qty: 1,
    name: c.name,
    isPC: player,
    maxHp,
    units: makeUnits(1, maxHp),
    loot: c.gear.map((g) => ({
      id: uid(),
      name: g.note.trim() ? `${g.name} (${g.note.trim()})` : g.name,
      taken: false,
    })),
    currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
    notes: c.notes,
    stats: statsFromCharacter(c),
  };
}

export function addCharacterToEncounter(encounter: Encounter, character: Character): Encounter {
  if (encounter.combatants.some((c) => c.characterId === character.id)) return encounter;
  return { ...encounter, combatants: [...encounter.combatants, combatantFromCharacter(character)] };
}
