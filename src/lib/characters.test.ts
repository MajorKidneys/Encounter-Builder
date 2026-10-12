import { describe, expect, it } from "vitest";
import { type Encounter } from "./encounters";
import {
  addCharacterToEncounter,
  addTemporarySlot,
  coerceCharacter,
  combatantFromCharacter,
  grantSlots,
  identity,
  longRest,
  makeCharacter,
  pipValue,
  setResourceCurrent,
  setSlotCurrent,
  shortRest,
} from "./characters";

function nyx() {
  const c = {
    ...makeCharacter("pc", "Nyx"),
    id: "pc1",
    race: "Half-elf",
    classes: "Cleric 5",
    maxHp: 38,
  };
  return grantSlots(grantSlots(c, "spell", 1, 4), "spell", 3, 2);
}

describe("characters", () => {
  it("shows race and class the same way for a player and an NPC", () => {
    expect(identity({ race: "Half-elf", classes: "Cleric 5" })).toBe("Half-elf · Cleric 5");
    expect(identity({ race: "Human", classes: "Fighter 7" })).toBe("Human · Fighter 7");
    expect(identity({ race: "", classes: "" })).toBe("Race and class not on sheet");
  });

  it("lets a player keep their own hit points and gives an NPC the saved maximum", () => {
    const player = combatantFromCharacter(nyx());
    expect(player).toMatchObject({ characterId: "pc1", isPC: true, maxHp: null, name: "Nyx" });
    expect(player.units[0]?.hp).toBe(0);
    expect(player.id).not.toBe("pc1");

    const npc = combatantFromCharacter({
      ...makeCharacter("npc", "Sister Mara"),
      id: "n1",
      race: "Human",
      classes: "Cleric 3",
      maxHp: 22,
    });
    expect(npc).toMatchObject({ isPC: false, maxHp: 22 });
    expect(npc.units[0]?.hp).toBe(22);
    expect(npc.stats?.meta).toBe("Human · Cleric 3");
  });

  it("adds someone to an encounter once, at the end of the list", () => {
    const encounter: Encounter = {
      id: "e",
      name: "Ambush",
      archived: false,
      createdAt: 1,
      combatants: [],
    };
    const mara = { ...makeCharacter("npc", "Sister Mara"), id: "n1", maxHp: 22 };
    const once = addCharacterToEncounter(encounter, nyx());
    const twice = addCharacterToEncounter(addCharacterToEncounter(once, nyx()), mara);
    expect(twice.combatants.map((c) => c.name)).toEqual(["Nyx", "Sister Mara"]);
  });

  it("refills pact slots and short-rest uses on a short rest, and everything lasting on a long rest", () => {
    let c = grantSlots(grantSlots(makeCharacter("pc", "Vesper"), "pact", 3, 2), "spell", 1, 4);
    c = addTemporarySlot(c, 2);
    c = {
      ...c,
      slots: c.slots.map((s) => ({ ...s, current: 0 })),
      resources: [
        { id: "ki", name: "Ki", max: 5, current: 1, reset: "short" },
        { id: "luck", name: "Luck", max: 3, current: 1, reset: "long" },
        { id: "boon", name: "Unclear boon", max: 1, current: 0, reset: null },
      ],
    };
    const afterShort = shortRest(c);
    expect(afterShort.slots.find((s) => s.kind === "pact")?.current).toBe(2);
    expect(afterShort.slots.find((s) => s.kind === "spell" && !s.temporary)?.current).toBe(0);
    expect(afterShort.resources.find((r) => r.name === "Ki")?.current).toBe(5);
    expect(afterShort.resources.find((r) => r.name === "Luck")?.current).toBe(1);

    const afterLong = longRest(setSlotCurrent(setResourceCurrent(c, "luck", 0), c.slots[0]!.id, 0));
    expect(afterLong.slots.some((s) => s.temporary)).toBe(false);
    expect(afterLong.slots.every((s) => s.current === s.max)).toBe(true);
    expect(afterLong.resources.find((r) => r.name === "Luck")?.current).toBe(3);
    expect(afterLong.resources.find((r) => r.name === "Unclear boon")?.current).toBe(0);
  });

  it("ticks a pip down or back up", () => {
    expect(pipValue(2, 4)).toBe(2);
    expect(pipValue(3, 2)).toBe(4);
  });

  it("reads an older name-and-HP record as a player character", () => {
    const c = coerceCharacter({ id: "pc1", name: "Nyx", maxHp: 27, notes: "Aasimar cleric" });
    expect(c).toMatchObject({
      id: "pc1",
      role: "pc",
      name: "Nyx",
      maxHp: 27,
      notes: "Aasimar cleric",
      classes: "",
    });
  });
});
