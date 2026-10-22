import { describe, expect, it } from "vitest";
import type { Encounter } from "./encounters";
import type { FolderState } from "./folders";
import { resolveDrop, type RowGeometry } from "./treeDrop";

const enc = (id: string, extra: Partial<Encounter> = {}): Encounter => ({
  id,
  name: id,
  archived: false,
  createdAt: 0,
  combatants: [],
  ...extra,
});
const state: FolderState = {
  folders: [{ id: "f", name: "F", parentId: null, sort: 2 }],
  encounters: [enc("a", { sort: 1 }), enc("x", { folderId: "f", sort: 1 }), enc("b", { sort: 3 })],
};
const A = { kind: "encounter", id: "a" } as const;
const F = { kind: "folder", id: "f" } as const;
const X = { kind: "encounter", id: "x" } as const;
const B = { kind: "encounter", id: "b" } as const;
const rows: RowGeometry[] = [
  { ref: A, parentId: null, root: A, openFolder: false, top: 0, bottom: 40 },
  { ref: F, parentId: null, root: F, openFolder: true, top: 40, bottom: 80 },
  { ref: X, parentId: "f", root: F, openFolder: false, top: 80, bottom: 120 },
  { ref: B, parentId: null, root: B, openFolder: false, top: 120, bottom: 160 },
];

describe("resolveDrop", () => {
  it("drops into the middle of a folder, at its end", () => {
    const hit = resolveDrop(state, rows, B, 60, false)!;
    expect(hit).toMatchObject({ parentId: "f", index: 1, mark: { key: "folder:f", edge: "into" } });
  });

  it("drops above or below a folder with its top and bottom quarter, below an open one means inside", () => {
    expect(resolveDrop(state, rows, B, 43, false)).toMatchObject({
      parentId: null,
      index: 1,
      mark: { edge: "before" },
    });
    expect(resolveDrop(state, rows, B, 77, false)).toMatchObject({ parentId: "f", index: 0 });
  });

  it("splits an encounter at its midline", () => {
    expect(resolveDrop(state, rows, B, 10, false)).toMatchObject({
      parentId: null,
      index: 0,
      mark: { key: "encounter:a", edge: "before" },
    });
    expect(resolveDrop(state, rows, B, 30, false)).toMatchObject({
      parentId: null,
      index: 1,
      mark: { edge: "after" },
    });
  });

  it("drops inside a folder next to its rows", () => {
    expect(resolveDrop(state, rows, A, 90, false)).toMatchObject({ parentId: "f", index: 0 });
  });

  it("takes an item out with the left gutter, or by dropping below the list", () => {
    expect(resolveDrop(state, rows, X, 100, true)).toMatchObject({
      parentId: null,
      index: 2 - 0,
      mark: { key: "folder:f", edge: "after" },
    });
    expect(resolveDrop(state, rows, X, 500, false)).toMatchObject({
      parentId: null,
      mark: { key: "end" },
    });
  });

  it("refuses to drop a row on itself or a folder into its own contents", () => {
    expect(resolveDrop(state, rows, A, 20, false)).toBeNull();
    expect(resolveDrop(state, rows, F, 100, false)).toBeNull();
    expect(resolveDrop(state, rows, F, 60, false)).toBeNull();
  });
});
