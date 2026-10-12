import { describe, expect, it } from "vitest";
import { type Encounter } from "./encounters";
import { combatantFromCharacter, withParty, type PlayerCharacter } from "./characters";

const nyx: PlayerCharacter = { id: "pc1", name: "Nyx", maxHp: 27, notes: "Aasimar cleric" };
const encounter: Encounter = {
  id: "e1",
  name: "Ambush",
  archived: false,
  createdAt: 1,
  combatants: [],
};

describe("player characters", () => {
  it("copies a saved character into an encounter row without sharing identity", () => {
    const row = combatantFromCharacter(nyx);
    expect(row).toMatchObject({
      characterId: "pc1",
      name: "Nyx",
      isPC: true,
      maxHp: 27,
      qty: 1,
      init: null,
      notes: "Aasimar cleric",
    });
    expect(row.id).not.toBe(nyx.id);
    expect(row.units).toEqual([{ id: row.units[0]!.id, hp: 27 }]);
  });

  it("adds the party once, skipping characters already in the encounter", () => {
    const first = withParty(encounter, [nyx]);
    const again = withParty(first, [nyx, { id: "pc2", name: "Borin", maxHp: null, notes: "" }]);
    expect(again.combatants.map((c) => c.name)).toEqual(["Borin", "Nyx"]);
    expect(again.combatants[0]).toMatchObject({ characterId: "pc2", maxHp: null, isPC: true });
    expect(again.combatants[0]?.units[0]?.hp).toBe(0);
  });
});
