/** A condition on one copy. `rounds` counts down when that creature's turn ends; null = until removed. */
export type Condition = {
  id: string;
  name: string;
  rounds?: number | null | undefined;
  level?: number | undefined;
  note?: string | undefined;
  expired?: boolean | undefined;
};
export type Unit = { id: string; hp: number; conditions?: Condition[] | undefined };
export type LootItem = {
  id: string;
  name: string;
  taken: boolean;
  equipmentId?: string;
  native?: boolean;
  nativeAction?: import("./monsters").Feature | undefined;
  bonus?: number | undefined;
  magicId?: string | undefined;
  homebrew?: boolean | undefined;
  desc?: string | undefined;
  acBonus?: number | undefined;
  str?: number | undefined;
  /** Free text, e.g. "negotiation or combat only". */ condition?: string | undefined;
  /** A check that has to succeed to take it, e.g. Medicine DC 14 to harvest venom. */ harvest?:
    { skill: string; dc: number } | undefined;
  /** Free text so it can hold "50-80 gp" or stay blank for story items. */ value?:
    string | undefined;
};
export type RoundBeat = { round: number | string; text: string };
export type Currency = { cp: number; sp: number; gp: number; pp: number };
export type Combatant = {
  id: string;
  /** null until the creature has rolled; unrolled creatures wait at the bottom and are skipped. */
  init: number | null;
  /** Holding (delaying) its turn; skipped until it acts. */
  held?: boolean | undefined;
  qty: number;
  name: string;
  isPC: boolean;
  maxHp: number | null;
  units: Unit[];
  loot: LootItem[];
  currency: Currency;
  notes: string;
  /** The DM marked this row dead. Used for player characters, whose hit points stay on their own sheet. */
  dead?: boolean | undefined;
  /** Set when this row was added from the campaign's saved party. The row is a copy. */
  characterId?: string | undefined;
  /** The saved NPC this row is, so a named character in a fight and on the NPC list are one person. */
  npcId?: string | undefined;
  /** The adventure's rule for how many, e.g. "1 per PC" or "4-6". The count itself is set on the row. */
  countNote?: string | undefined;
  /** When this group enters the fight: with everyone (start), on a round, or when the DM calls them (manual). */
  joins?: "start" | "manual" | number | undefined;
  stats?: import("./monsters").MonsterStats | undefined;
  gearVersion?: number;
  gearAc?: number;
};
export type Encounter = {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  combatants: Combatant[];
  /** The adventure session this was prepared for, e.g. "Winwoods S1 - Homecoming". */
  session?: string | undefined;
  /** Room or scene key from the adventure, e.g. "U3" or "G1 Conservatory". */
  location?: string | undefined;
  /** Dormant encounters only happen on a condition; `trigger` says which. */
  status?: "staged" | "dormant" | undefined;
  trigger?: string | undefined;
  tactics?: string | undefined;
  morale?: string | undefined;
  /** Notes shown when a round starts. `round` can be a number, or "6+" for that round and every one after. */
  beats?: RoundBeat[] | undefined;
  /** Loot found in the room itself, not carried by a creature. */
  roomLoot?: LootItem[] | undefined;
  /** Scene description the GM reads at the table: where this is and what is in front of them. */
  setting?: string | undefined;
  aliases?: string[] | undefined;
  /** Folder this encounter sits in. Missing means top level. */
  folderId?: string | null | undefined;
  /** Position among its siblings (folders and encounters share one order). Missing falls back to list order. */
  sort?: number | undefined;
  /** 0 or missing = combat not started. */
  round?: number | undefined;
  /** Combatant whose turn it is. */
  turnId?: string | null | undefined;
  /** Undo stack for Next, Hold, and Act now. Previous restores the last entry. */
  turnHistory?: import("./turns").TurnFrame[] | undefined;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeUnits(qty: number, hp: number | null): Unit[] {
  return Array.from({ length: Math.max(1, qty) }, () => ({ id: uid(), hp: hp ?? 0 }));
}

/** Adds or removes copies of a group. Existing copies keep their hit points; new ones start at max. */
export function setCombatantQty(c: Combatant, qty: number): Combatant {
  const next = Math.max(1, Math.min(50, Math.floor(qty) || 1));
  if (next === c.units.length && c.qty === next) return c;
  return {
    ...c,
    qty: next,
    units:
      next > c.units.length
        ? [...c.units, ...makeUnits(next - c.units.length, c.maxHp)]
        : c.units.slice(0, next),
  };
}

export function lootTotalGp(c: Currency) {
  return c.cp / 100 + c.sp / 10 + c.gp + c.pp * 10;
}
