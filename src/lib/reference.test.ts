import { describe, expect, it } from "vitest";
import { CONDITIONS } from "./turns";
import { allEntries, conditionEntryId, getEntry, searchEntries } from "./reference";

describe("reference glossary", () => {
  const entries = allEntries();

  it("gives every tracked condition an entry", () => {
    for (const name of CONDITIONS) {
      const entry = getEntry(conditionEntryId(name));
      expect(entry?.short.length, name).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique, related ids real, and tooltips short", () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of entries) {
      expect(entry.short.length).toBeLessThanOrEqual(160);
      for (const related of entry.related ?? []) {
        expect(getEntry(related), `${entry.id} → ${related}`).toBeTruthy();
      }
    }
  });

  it("finds aliases and short text across tabs", () => {
    expect(searchEntries("grab").map((entry) => entry.id)).toContain("grappled");
    expect(searchEntries("dark").map((entry) => entry.id)).toContain("vision-and-light");
    expect(searchEntries("death save").some((entry) => entry.id === "dropping-to-0-hp")).toBe(true);
    expect(searchEntries("zzzz-not-a-rule")).toEqual([]);
  });
});
