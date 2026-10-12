import { makeUnits, uid, type Combatant, type Encounter } from "./encounters";

/**
 * A player character saved on a campaign. Encounter rows are copies
 * (`combatantFromCharacter`); editing a row does not write back here.
 * The party list UI is a follow-up — this shape is what it will persist.
 */
export type PlayerCharacter = {
  id: string;
  name: string;
  /** null = the player tracks HP, matching an encounter PC with no HP set. */
  maxHp: number | null;
  notes: string;
};

export function combatantFromCharacter(pc: PlayerCharacter): Combatant {
  return {
    id: uid(),
    characterId: pc.id,
    init: null,
    qty: 1,
    name: pc.name,
    isPC: true,
    maxHp: pc.maxHp,
    units: makeUnits(1, pc.maxHp),
    loot: [],
    currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
    notes: pc.notes,
  };
}

/** Drops each saved character into an encounter as a fresh PC row. */
export function withParty(encounter: Encounter, party: PlayerCharacter[]): Encounter {
  const present = new Set(encounter.combatants.map((c) => c.characterId).filter(Boolean));
  const added = party.filter((pc) => !present.has(pc.id)).map(combatantFromCharacter);
  if (added.length === 0) return encounter;
  return { ...encounter, combatants: [...added, ...encounter.combatants] };
}
