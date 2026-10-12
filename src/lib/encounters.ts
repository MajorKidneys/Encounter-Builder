import { useEffect, useState } from "react";

/** A condition on one copy. `rounds` counts down when that creature's turn ends; null = until removed. */
export type Condition = { id: string; name: string; rounds?: number | null | undefined; level?: number | undefined; note?: string | undefined; expired?: boolean | undefined };
export type Unit = { id: string; hp: number; conditions?: Condition[] | undefined };
export type LootItem = { id: string; name: string; taken: boolean; equipmentId?: string; native?: boolean; nativeAction?: import('./monsters').Feature | undefined; bonus?: number | undefined; magicId?: string | undefined; homebrew?: boolean | undefined; desc?: string | undefined; acBonus?: number | undefined; str?: number | undefined };
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
  /** 0 or missing = combat not started. */
  round?: number | undefined;
  /** Combatant whose turn it is. */
  turnId?: string | null | undefined;
  /** Undo stack for Next, Hold, and Act now. Previous restores the last entry. */
  turnHistory?: import("./turns").TurnFrame[] | undefined;
};

const KEY = "dm-encounters-v1";
export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeUnits(qty: number, hp: number | null): Unit[] {
  return Array.from({ length: Math.max(1, qty) }, () => ({ id: uid(), hp: hp ?? 0 }));
}

export function lootTotalGp(c: Currency) {
  return c.cp / 100 + c.sp / 10 + c.gp + c.pp * 10;
}

export function useEncounters() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setEncounters(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(encounters));
  }, [encounters, loaded]);
  return { encounters, setEncounters, loaded };
}
