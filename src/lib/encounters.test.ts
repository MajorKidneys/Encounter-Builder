import { describe, expect, it } from "vitest";
import { setCombatantQty, type Combatant } from "./encounters";

const group = (copies: number): Combatant => ({
  id: "z",
  init: null,
  qty: copies,
  name: "Zombie",
  isPC: false,
  maxHp: 22,
  units: Array.from({ length: copies }, (_, i) => ({ id: `u${i}`, hp: 22 - i })),
  loot: [],
  currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
  notes: "",
});

describe("setCombatantQty", () => {
  it("adds copies at full hit points and keeps the ones already there", () => {
    const next = setCombatantQty(group(2), 4);
    expect(next.qty).toBe(4);
    expect(next.units.map((u) => u.hp)).toEqual([22, 21, 22, 22]);
  });

  it("drops copies from the end and refuses to go below one or above fifty", () => {
    const fewer = setCombatantQty(group(3), 1);
    expect(fewer.units.map((u) => u.id)).toEqual(["u0"]);
    expect(setCombatantQty(group(2), 0).units).toHaveLength(1);
    expect(setCombatantQty(group(2), 80).units).toHaveLength(50);
  });
});
