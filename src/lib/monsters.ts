import { uid } from "./encounters";

export type Feature = { name: string; desc: string; attack?: number | undefined; damage?: string | undefined; lootId?: string; nativeGear?: boolean; calculatedAttack?: number; calculatedDamage?: string };
export type Spellcasting = { name: string; dc: number | null; attack: number | null; ability: string; list: string; casterLevel?: number | undefined; slots?: number[] | undefined; used?: number[] | undefined; entries?: import("./spells").SpellEntry[] | undefined };
export type ResetOn = "turn" | "round" | "short" | "long";
export type Resource = { id: string; name: string; max: number; current: number; reset: ResetOn; note?: string };
export type MonsterStats = {
  srdId: string | null;
  srd: boolean;
  source?: string | undefined;
  description?: string | undefined;
  name: string;
  meta: string;
  ac: number;
  acNote: string;
  hp: number;
  hitDice: string;
  speed: string;
  abilities: number[];
  saves: string;
  skills: string;
  passive: number;
  senses: string;
  languages: string;
  cr: number;
  vuln: string;
  resist: string;
  immune: string;
  condImmune: string;
  special: Feature[];
  actions: Feature[];
  reactions: Feature[];
  legendary: Feature[];
  spells: Spellcasting[];
  resources: Resource[];
};

export type LibraryMonster = Omit<MonsterStats, "srdId" | "resources"> & {
  id: string;
  resources: Omit<Resource, "id" | "current">[];
};

let cache: LibraryMonster[] | null = null;
export async function loadLibrary(): Promise<LibraryMonster[]> {
  if (!cache) {
    const [srd, a5e, descriptions] = await Promise.all([
      import("@/data/srd-monsters.json"),
      import("@/data/a5e-monsters.json"),
      import("@/data/monster-descriptions.json"),
    ]);
    const text = descriptions.default as Record<string, string>;
    cache = [...(srd.default as LibraryMonster[]), ...(a5e.default as LibraryMonster[])].map((m) =>
      text[m.id] ? { ...m, description: text[m.id] } : m,
    );
  }
  return cache;
}

export function fromLibrary(m: LibraryMonster): MonsterStats {
  const { id, resources, ...rest } = structuredClone(m);
  return { ...rest, srdId: id, resources: resources.map((r) => ({ ...r, id: uid(), current: r.max })) };
}

export function blankStats(name: string): MonsterStats {
  return {
    srdId: null, srd: false, name, meta: "", ac: 10, acNote: "", hp: 10, hitDice: "", speed: "30 ft.",
    abilities: [10, 10, 10, 10, 10, 10], saves: "", skills: "", passive: 10, senses: "", languages: "", cr: 0,
    vuln: "", resist: "", immune: "", condImmune: "", special: [], actions: [], reactions: [], legendary: [],
    spells: [], resources: [],
  };
}

export const mod = (s: number = 10) => {
  const m = Math.floor((s - 10) / 2);
  return `${m >= 0 ? "+" : ""}${m}`;
};
export const crLabel = (cr: number) => (cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));
