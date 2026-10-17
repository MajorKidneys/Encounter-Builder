import type { Keys } from "./dataFile.js";

// Only the fields the connector reads. The app's full types live in src/lib/encounters.ts and characters.ts.
export type LootItem = { id?: string; name: string; taken?: boolean; desc?: string };
export type Combatant = {
  id: string;
  name: string;
  qty?: number;
  isPC?: boolean;
  init?: number | null;
  maxHp?: number | null;
  loot?: LootItem[];
  currency?: { cp?: number; sp?: number; gp?: number; pp?: number };
  notes?: string;
  stats?: { srdId?: string | null; srd?: boolean; name?: string; meta?: string; cr?: number; ac?: number; hp?: number; hitDice?: string };
};
export type Encounter = {
  id: string;
  name: string;
  archived?: boolean;
  round?: number;
  combatants: Combatant[];
};
export type Character = {
  id: string;
  role: "pc" | "npc";
  name: string;
  race?: string;
  classes?: string;
  ac?: number | null;
  maxHp?: number | null;
  notes?: string;
};
export type CampaignView = {
  id: string;
  name: string;
  active: boolean;
  encounters: Encounter[];
  /** Saved party roster. Empty on app versions that don't have one yet. */
  characters: Character[];
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Reads campaigns from the data file. Understands both layouts: the multi-campaign one
 * (`dm-campaigns-v2` plus per-campaign `dm-c-<id>-...` keys) and the original single-campaign one.
 */
export function loadCampaigns(keys: Keys): CampaignView[] {
  const index = keys["dm-campaigns-v2"] as
    | { activeId?: string; campaigns?: { id: string; name: string }[] }
    | undefined;
  if (index && Array.isArray(index.campaigns) && index.campaigns.length > 0) {
    return index.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.id === index.activeId,
      encounters: asArray<Encounter>(keys[`dm-c-${c.id}-encounters`]),
      characters: asArray<Character>(keys[`dm-c-${c.id}-characters`]),
    }));
  }
  const name = keys["dm-campaign-name-v1"];
  return [
    {
      id: "default",
      name: typeof name === "string" && name.trim() ? name : "YOUR ADVENTURE",
      active: true,
      encounters: asArray<Encounter>(keys["dm-encounters-v1"]),
      characters: [],
    },
  ];
}

/** Picks a campaign by id or name; with no choice, the active one. */
export function pickCampaign(campaigns: CampaignView[], choice?: string): CampaignView {
  if (choice?.trim()) {
    const want = choice.trim().toLowerCase();
    const hit =
      campaigns.find((c) => c.id === choice.trim()) ??
      campaigns.find((c) => c.name.toLowerCase() === want) ??
      campaigns.find((c) => c.name.toLowerCase().includes(want));
    if (!hit) {
      throw new Error(
        `No campaign matches "${choice}". Campaigns: ${campaigns.map((c) => c.name).join(", ")}.`,
      );
    }
    return hit;
  }
  return campaigns.find((c) => c.active) ?? campaigns[0]!;
}
