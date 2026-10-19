import { describe, expect, it } from "vitest";
import { beatsForRound, hasPrep, joinsLabel } from "./prep";
import type { Encounter } from "./encounters";

const beats = [
  { round: 1, text: "Horn sounds" },
  { round: "3+", text: "Fire arrows each round" },
  { round: 3, text: "Panic" },
  { round: "5", text: "Cavalry" },
];

describe("round beats", () => {
  it("matches exact rounds, open-ended ones, and numeric text", () => {
    expect(beatsForRound(beats, 1).map((b) => b.text)).toEqual(["Horn sounds"]);
    expect(beatsForRound(beats, 2)).toEqual([]);
    expect(beatsForRound(beats, 3).map((b) => b.text)).toEqual(["Panic", "Fire arrows each round"]);
    expect(beatsForRound(beats, 5).map((b) => b.text)).toEqual([
      "Fire arrows each round",
      "Cavalry",
    ]);
    expect(beatsForRound(undefined, 1)).toEqual([]);
  });
});

describe("prep helpers", () => {
  const base: Encounter = { id: "e", name: "x", archived: false, createdAt: 0, combatants: [] };
  it("only shows the panel when there is something to show", () => {
    expect(hasPrep(base)).toBe(false);
    expect(hasPrep({ ...base, status: "staged" })).toBe(false);
    expect(hasPrep({ ...base, status: "dormant" })).toBe(true);
    expect(hasPrep({ ...base, morale: "Break at 50%" })).toBe(true);
  });
  it("describes when a group joins", () => {
    expect(joinsLabel(undefined)).toBeNull();
    expect(joinsLabel("start")).toBeNull();
    expect(joinsLabel("manual")).toBe("Joins when you call them");
    expect(joinsLabel(5)).toBe("Joins round 5");
  });
});
