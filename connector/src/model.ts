import { coerceCharacter, type Character } from "@/lib/characters";
import type { SpellList } from "@/lib/spells";
import type { Combatant, Encounter, LootItem } from "@/lib/encounters";
import type { Keys } from "./dataFile.js";

export type { Character, Combatant, Encounter, LootItem };

export type CampaignView = {
  id: string;
  name: string;
  active: boolean;
  encounters: Encounter[];
  /** Saved party roster and NPC list. */
  characters: Character[];
  /** Named spell lists shown on the Spell Book page. */
  spellLists: SpellList[];
  /** The storage keys this campaign's data lives under, or null on the original single-campaign layout. */
  keys: { encounters: string; characters: string; spellLists: string } | null;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asCharacters = (value: unknown): Character[] =>
  asArray<unknown>(value)
    .map(coerceCharacter)
    .filter((c): c is Character => c !== null);

/**
 * Reads campaigns from the data file. Understands both layouts: the multi-campaign one
 * (`dm-campaigns-v2` plus per-campaign `dm-c-<id>-...` keys) and the original single-campaign one.
 */
export function loadCampaigns(keys: Keys): CampaignView[] {
  const index = keys["dm-campaigns-v2"] as
    { activeId?: string; campaigns?: { id: string; name: string }[] } | undefined;
  if (index && Array.isArray(index.campaigns) && index.campaigns.length > 0) {
    return index.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.id === index.activeId,
      encounters: asArray<Encounter>(keys[`dm-c-${c.id}-encounters`]),
      characters: asCharacters(keys[`dm-c-${c.id}-characters`]),
      spellLists: asArray<SpellList>(keys[`dm-c-${c.id}-spell-lists`]),
      keys: {
        encounters: `dm-c-${c.id}-encounters`,
        characters: `dm-c-${c.id}-characters`,
        spellLists: `dm-c-${c.id}-spell-lists`,
      },
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
      spellLists: [],
      keys: null,
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
