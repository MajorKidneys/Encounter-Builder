import { describe, expect, it } from "vitest";
import { blankStats, fromLibrary, loadLibrary } from "./monsters";

describe("Monster descriptions", () => {
  it("bundles source text and copies it on import without modifying the library", async () => {
    const library = await loadLibrary();
    const acolyte = library.find((m) => m.id === "acolyte");
    if (!acolyte) throw new Error("Missing SRD acolyte");
    expect(acolyte.description).toContain("junior members of a clergy");
    const imported = fromLibrary(acolyte);
    expect(imported.description).toBe(acolyte.description);
    imported.description = "Campaign lore";
    expect(acolyte.description).not.toBe(imported.description);
    expect(library.find((m) => m.id === "a5e-aboleth")?.description).toBeUndefined();
    expect(blankStats("NPC").description).toBeUndefined();
  });
});