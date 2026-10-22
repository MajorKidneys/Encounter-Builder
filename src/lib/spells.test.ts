import { describe, expect, it } from "vitest";
import { loadSpells, visibleSpells } from "./spells";

describe("visibleSpells", () => {
  it("shows every spell on a saved list, whatever the Spell Book search says", async () => {
    const all = await loadSpells();
    const list = { id: "l", name: "Vinegar Pete", spellIds: all.slice(0, 5).map((s) => s.id) };
    const book = visibleSpells(all, null, { q: "acid", level: "2", cls: "Wizard" });
    expect(book.length).toBeLessThan(all.length);
    const shown = visibleSpells(all, list, { q: "acid", level: "2", cls: "Wizard" });
    expect(shown.map((s) => s.id)).toEqual(list.spellIds);
  });

  it("filters the Spell Book by name, level and class", async () => {
    const all = await loadSpells();
    const hits = visibleSpells(all, null, { q: "acid", level: "", cls: "" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((s) => s.name.toLowerCase().includes("acid"))).toBe(true);
  });
});
