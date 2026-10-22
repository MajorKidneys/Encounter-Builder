import { describe, expect, it } from "vitest";
import type { Encounter } from "./encounters";
import {
  MAX_DEPTH,
  addFolder,
  ancestorFolderIds,
  buildTree,
  canCreateFolderIn,
  canMove,
  deleteFolder,
  ensureFolderPath,
  findFolderByPath,
  folderDepth,
  folderPath,
  moveItem,
  moveToEnd,
  siblingsOf,
  visibleRows,
  type EncounterFolder,
  type FolderState,
} from "./folders";

const enc = (id: string, extra: Partial<Encounter> = {}): Encounter => ({
  id,
  name: id.toUpperCase(),
  archived: false,
  createdAt: 0,
  combatants: [],
  ...extra,
});
const fold = (id: string, parentId: string | null, sort: number): EncounterFolder => ({
  id,
  name: id,
  parentId,
  sort,
});
const names = (state: FolderState, parent: string | null) =>
  siblingsOf(state, parent).map((s) => s.ref.id);

describe("tree", () => {
  it("shows an old flat campaign exactly as it was", () => {
    const state = { folders: [], encounters: [enc("a"), enc("b"), enc("c")] };
    expect(names(state, null)).toEqual(["a", "b", "c"]);
    expect(buildTree(state).map((n) => n.type)).toEqual(["encounter", "encounter", "encounter"]);
  });

  it("mixes folders and encounters in one order and counts what is inside", () => {
    const state: FolderState = {
      folders: [fold("f", null, 2), fold("g", "f", 1)],
      encounters: [
        enc("a", { sort: 1 }),
        enc("b", { folderId: "f", sort: 2 }),
        enc("c", { folderId: "g", sort: 1 }),
        enc("d", { sort: 3 }),
      ],
    };
    const tree = buildTree(state);
    expect(tree.map((n) => (n.type === "folder" ? n.folder.id : n.encounter.id))).toEqual([
      "a",
      "f",
      "d",
    ]);
    const f = tree[1]!;
    expect(f.type === "folder" && f.count).toBe(2);
    const rows = visibleRows(tree, (id) => id === "f");
    expect(
      rows.map((r) => [r.node.type === "folder" ? r.node.folder.id : r.node.encounter.id, r.depth]),
    ).toEqual([
      ["a", 0],
      ["f", 0],
      ["g", 1],
      ["b", 1],
      ["d", 0],
    ]);
  });

  it("puts anything pointing at a missing folder back at the top level", () => {
    const state = { folders: [], encounters: [enc("a", { folderId: "gone" })] };
    expect(names(state, null)).toEqual(["a"]);
  });
});

describe("depth and move rules", () => {
  const folders = [fold("a", null, 1), fold("b", "a", 1), fold("c", "b", 1), fold("x", null, 2)];

  it("measures depth and caps nesting at three", () => {
    expect(folderDepth(folders, "c")).toBe(3);
    expect(canCreateFolderIn(folders, "b")).toBe(true);
    expect(canCreateFolderIn(folders, "c")).toBe(false);
    expect(MAX_DEPTH).toBe(3);
  });

  it("refuses cycles and moves that go too deep", () => {
    expect(canMove(folders, { kind: "folder", id: "a" }, "c")).toBe(false);
    expect(canMove(folders, { kind: "folder", id: "a" }, "a")).toBe(false);
    expect(canMove(folders, { kind: "folder", id: "x" }, "c")).toBe(false);
    expect(canMove(folders, { kind: "folder", id: "x" }, "b")).toBe(true);
    expect(canMove(folders, { kind: "folder", id: "a" }, "x")).toBe(false);
    expect(canMove(folders, { kind: "encounter", id: "e" }, "c")).toBe(true);
  });
});

describe("moving", () => {
  const base = (): FolderState => ({
    folders: [fold("f", null, 10)],
    encounters: [enc("a", { sort: 1 }), enc("b", { sort: 2 }), enc("c", { sort: 3 })],
  });

  it("reorders with a fractional sort and touches one row", () => {
    const before = base();
    const next = moveItem(before, { kind: "encounter", id: "c" }, null, 1);
    expect(names(next, null)).toEqual(["a", "c", "b", "f"]);
    expect(next.encounters.find((e) => e.id === "c")!.sort).toBe(1.5);
    expect(next.encounters.find((e) => e.id === "a")).toBe(before.encounters[0]);
  });

  it("moves into a folder and back out", () => {
    const inside = moveItem(base(), { kind: "encounter", id: "a" }, "f", 0);
    expect(inside.encounters.find((e) => e.id === "a")!.folderId).toBe("f");
    expect(names(inside, "f")).toEqual(["a"]);
    const out = moveItem(inside, { kind: "encounter", id: "a" }, null, 0);
    expect(names(out, null)[0]).toBe("a");
    expect(out.encounters.find((e) => e.id === "a")!.folderId).toBeNull();
  });

  it("renumbers when neighbors have no sort or sit too close", () => {
    const flat = { folders: [], encounters: [enc("a"), enc("b"), enc("c")] };
    const moved = moveItem(flat, { kind: "encounter", id: "c" }, null, 0);
    expect(names(moved, null)).toEqual(["c", "a", "b"]);
    expect(moved.encounters.map((e) => e.sort)).toEqual([2, 3, 1]);

    let state: FolderState = {
      folders: [],
      encounters: [enc("a", { sort: 1 }), enc("b", { sort: 2 }), enc("z", { sort: 3 })],
    };
    for (let i = 0; i < 40; i++) state = moveItem(state, { kind: "encounter", id: "z" }, null, 1);
    expect(names(state, null)).toEqual(["a", "z", "b"]);
    const sorts = siblingsOf(state, null).map((s) => s.sort);
    expect(sorts[1]! - sorts[0]!).toBeGreaterThanOrEqual(1e-6);
  });

  it("ignores a move that breaks the rules", () => {
    const state: FolderState = { folders: [fold("a", null, 1), fold("b", "a", 1)], encounters: [] };
    expect(moveItem(state, { kind: "folder", id: "a" }, "b", 0)).toBe(state);
  });

  it("appends to the end of a folder", () => {
    const next = moveToEnd(
      moveItem(base(), { kind: "encounter", id: "a" }, "f", 0),
      { kind: "encounter", id: "b" },
      "f",
    );
    expect(names(next, "f")).toEqual(["a", "b"]);
  });
});

describe("deleting a folder", () => {
  it("moves everything up a level, in the folder's place, and loses nothing", () => {
    const state: FolderState = {
      folders: [fold("f", null, 2), fold("sub", "f", 2)],
      encounters: [
        enc("a", { sort: 1 }),
        enc("x", { folderId: "f", sort: 1 }),
        enc("y", { folderId: "sub", sort: 1 }),
        enc("z", { sort: 3 }),
      ],
    };
    const next = deleteFolder(state, "f");
    expect(next.folders.map((f) => f.id)).toEqual(["sub"]);
    expect(names(next, null)).toEqual(["a", "x", "sub", "z"]);
    expect(next.folders[0]!.parentId).toBeNull();
    expect(next.encounters).toHaveLength(4);
    expect(next.encounters.find((e) => e.id === "y")!.folderId).toBe("sub");
  });
});

describe("paths", () => {
  it("creates missing folders, reuses existing ones regardless of case, and enforces the cap", () => {
    let n = 0;
    const id = () => `n${++n}`;
    const first = ensureFolderPath(
      { folders: [], encounters: [] },
      ["Join the band", "Sent on the raid"],
      id,
    );
    expect(folderPath(first.state.folders, first.id)).toBe("Join the band / Sent on the raid");
    const again = ensureFolderPath(first.state, ["join the BAND", "sent on the raid"], id);
    expect(again.id).toBe(first.id);
    expect(again.state.folders).toHaveLength(2);
    expect(() => ensureFolderPath(first.state, ["a", "b", "c", "d"], id)).toThrow(/3 levels/);
    expect(findFolderByPath(first.state.folders, ["nope"])).toBeNull();
    expect(findFolderByPath(first.state.folders, [])).toEqual({ id: null });
  });

  it("lists the folders that hold an encounter, outermost first", () => {
    const folders = [fold("a", null, 1), fold("b", "a", 1)];
    expect(ancestorFolderIds(folders, enc("e", { folderId: "b" }))).toEqual(["a", "b"]);
    expect(
      addFolder({ folders, encounters: [] }, { id: "n", name: "N", parentId: "a" }).folders.at(-1)!
        .sort,
    ).toBe(2);
  });
});
