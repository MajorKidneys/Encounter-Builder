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

import {
  applyDraft,
  draftErrors,
  draftFromEncounter,
  parseBeatRound,
  prepSummary,
  firstLine,
  isLongLocation,
} from "./prep";

describe("beat rounds", () => {
  it("accepts a round or N+ and rejects everything else", () => {
    expect(parseBeatRound("2")).toEqual({ ok: true, round: 2 });
    expect(parseBeatRound(" 6 + ")).toEqual({ ok: true, round: "6+" });
    for (const bad of ["", "0", "-1", "two", "1.5", "+3", "3++"])
      expect(parseBeatRound(bad).ok).toBe(false);
  });
});

describe("prep editor", () => {
  const base: Encounter = { id: "e", name: "x", archived: false, createdAt: 0, combatants: [] };

  it("round-trips an encounter with nothing changed", () => {
    const e: Encounter = {
      ...base,
      session: "S3",
      location: "G1",
      tactics: "Hide",
      beats: [{ round: "4+", text: "Run" }],
      roomLoot: [
        { id: "l1", name: "Apples", taken: true, condition: "once picked", value: "2 gp" },
      ],
    };
    expect(applyDraft(e, draftFromEncounter(e))).toEqual(e);
  });

  it("turns empty text into missing fields", () => {
    const e: Encounter = { ...base, tactics: "Hide", morale: "Flees", location: "G1" };
    const d = { ...draftFromEncounter(e), tactics: "  ", morale: "" };
    const saved = applyDraft(e, d);
    expect("tactics" in saved).toBe(false);
    expect("morale" in saved).toBe(false);
    expect(saved.location).toBe("G1");
  });

  it("adds new loot untaken, keeps value and taken on old loot, and drops blank rows", () => {
    const e: Encounter = {
      ...base,
      roomLoot: [{ id: "l1", name: "Chalice", taken: true, value: "50 gp" }],
    };
    const d = draftFromEncounter(e);
    d.loot[0]!.name = "Silver chalice";
    d.loot.push(
      { key: "n", id: null, name: "Apples", detail: "Dewey's" },
      { key: "m", id: null, name: " ", detail: "x" },
    );
    const saved = applyDraft(e, d);
    expect(saved.roomLoot).toHaveLength(2);
    expect(saved.roomLoot![0]).toEqual({
      id: "l1",
      name: "Silver chalice",
      taken: true,
      value: "50 gp",
    });
    expect(saved.roomLoot![1]).toMatchObject({
      name: "Apples",
      taken: false,
      condition: "Dewey's",
    });
  });

  it("flags bad beat rounds and ignores empty beat rows", () => {
    const d = { ...draftFromEncounter(base) };
    d.beats = [
      { key: "a", round: "x", text: "Boom" },
      { key: "b", round: "", text: "" },
      { key: "c", round: "3+", text: "Fine" },
    ];
    expect(Object.keys(draftErrors(d))).toEqual(["a"]);
  });

  it("marks dormant, and returns to staged when unchecked", () => {
    const dormant = applyDraft(base, {
      ...draftFromEncounter(base),
      dormant: true,
      trigger: "If asked",
    });
    expect(dormant).toMatchObject({ status: "dormant", trigger: "If asked" });
    expect(applyDraft(dormant, { ...draftFromEncounter(dormant), dormant: false }).status).toBe(
      "staged",
    );
  });

  it("summarises and reads long locations", () => {
    expect(
      prepSummary({
        ...base,
        tactics: "x",
        morale: "y",
        roomLoot: [{ id: "1", name: "a", taken: false }],
      }),
    ).toBe("Tactics · Morale · 1 loot");
    expect(firstLine("\n\nThe patrol arrives.\nMore")).toBe("The patrol arrives.");
    expect(isLongLocation("U3")).toBe(false);
    expect(isLongLocation("x".repeat(41))).toBe(true);
  });
});
