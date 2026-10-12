import { describe, expect, it } from "vitest";
import { type Combatant, type Encounter, makeUnits } from "./encounters";
import { blankStats } from "./monsters";
import {
  actNow,
  applyHp,
  holdTurn,
  nextTurn,
  prevTurn,
  removeCombatant,
  startCombat,
  turnOrder,
} from "./turns";

const mk = (id: string, init: number | null, extra: Partial<Combatant> = {}): Combatant => ({
  id,
  init,
  qty: 1,
  name: id,
  isPC: false,
  maxHp: 10,
  units: makeUnits(1, 10),
  loot: [],
  currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
  notes: "",
  ...extra,
});
const enc = (cs: Combatant[]): Encounter => ({
  id: "e",
  name: "E",
  archived: false,
  createdAt: 0,
  combatants: cs,
});

describe("turn order", () => {
  it("sorts rolled creatures and keeps unrolled ones last", () => {
    const order = turnOrder([mk("a", 5), mk("b", null), mk("c", 18), mk("d", 5)]);
    expect(order.map((c) => c.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("starts with the highest roll and skips unrolled and downed creatures", () => {
    const dead = mk("dead", 20, { units: [{ id: "u", hp: 0 }] });
    let e = startCombat(enc([dead, mk("a", 15), mk("wait", null), mk("b", 3)]));
    expect([e.round, e.turnId]).toEqual([1, "a"]);
    e = nextTurn(e);
    expect(e.turnId).toBe("b");
    e = nextTurn(e);
    expect([e.round, e.turnId]).toEqual([2, "a"]);
    e = prevTurn(e);
    expect([e.round, e.turnId]).toEqual([1, "b"]);
  });

  it("counts timed conditions down at the start of that creature's turn and asks when they end", () => {
    const a = mk("a", 15);
    a.units[0]!.conditions = [{ id: "k", name: "Frightened", rounds: 1 }];
    let e = startCombat(enc([mk("b", 20), a]));
    e = nextTurn(e);
    expect(e.combatants.find((c) => c.id === "a")!.units[0]!.conditions![0]).toMatchObject({
      rounds: 0,
      expired: true,
    });
  });

  it("refills turn resources on the creature's turn and round resources each new round", () => {
    const stats = {
      ...blankStats("x"),
      resources: [
        { id: "t", name: "Reaction", max: 1, current: 0, reset: "turn" as const },
        { id: "r", name: "Legendary", max: 3, current: 0, reset: "round" as const },
      ],
    };
    let e = startCombat(enc([mk("a", 15, { stats }), mk("b", 10)]));
    expect(e.combatants[0]!.stats!.resources.map((r) => r.current)).toEqual([1, 0]);
    e = nextTurn(nextTurn(e));
    expect(e.combatants[0]!.stats!.resources.map((r) => r.current)).toEqual([1, 3]);
  });

  it("holds a turn and lets the creature act before whoever is up", () => {
    let e = startCombat(enc([mk("a", 20), mk("b", 15), mk("c", 10)]));
    e = holdTurn(e);
    expect(e.turnId).toBe("b");
    e = nextTurn(e);
    expect(e.turnId).toBe("c");
    e = actNow(e, "a");
    expect(e.turnId).toBe("a");
    expect(turnOrder(e.combatants).map((c) => c.id)).toEqual(["b", "a", "c"]);
    e = nextTurn(e);
    expect(e.turnId).toBe("c");
  });

  it("hands the turn on when the active creature is removed", () => {
    const e = removeCombatant(startCombat(enc([mk("a", 20), mk("b", 15)])), "a");
    expect(e.turnId).toBe("b");
  });
});

describe("hit points", () => {
  it("reports the concentration save DC and drops concentration at 0", () => {
    const c = mk("a", 10, {
      maxHp: 30,
      units: [
        { id: "u", hp: 30, conditions: [{ id: "k", name: "Concentrating", note: "Hold Person" }] },
      ],
    });
    const hit = applyHp(c, "u", 24);
    expect(hit.result?.concentrationDc).toBe(12);
    const ko = applyHp(hit.combatant, "u", 50);
    expect(ko.result?.concentrationLost).toBe("Hold Person");
    expect(ko.combatant.units[0]!.conditions!.map((k) => k.name)).toEqual(["Unconscious"]);
    const healed = applyHp(ko.combatant, "u", -5);
    expect(healed.combatant.units[0]!.hp).toBe(5);
    expect(healed.combatant.units[0]!.conditions).toEqual([]);
  });
});
