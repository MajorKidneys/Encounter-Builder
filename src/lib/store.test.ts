import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readKey, resetStoreForTests, storageReady, writeKey, subscribeKey } from "./store";

const { createStore } = createRequire(import.meta.url)("../../electron/store.cjs") as {
  createStore: (dir: string) => {
    file: string;
    getAll(): Record<string, unknown>;
    set(k: string, v: unknown): void;
    remove(k: string): void;
    onExternalChange(cb: (c: { key: string; value: unknown }[]) => void): () => void;
    watch(): void;
    close(): void;
  };
};

describe("data file", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "tracker-"));
  });

  it("round-trips keys and creates the folder file on first write", () => {
    const store = createStore(path.join(dir, "nested"));
    expect(store.getAll()).toEqual({});
    store.set("dm-a", [1, 2]);
    store.set("dm-b", "x");
    expect(store.getAll()).toEqual({ "dm-a": [1, 2], "dm-b": "x" });
    store.remove("dm-a");
    expect(createStore(path.join(dir, "nested")).getAll()).toEqual({ "dm-b": "x" });
  });

  it("keeps an edit made by another process (re-reads before writing)", () => {
    const store = createStore(dir);
    store.set("dm-a", 1);
    const outside = JSON.parse(readFileSync(store.file, "utf8"));
    outside.keys["dm-connector"] = { added: true };
    writeFileSync(store.file, JSON.stringify(outside));
    store.set("dm-b", 2);
    expect(store.getAll()).toEqual({ "dm-a": 1, "dm-connector": { added: true }, "dm-b": 2 });
  });

  it("moves an unreadable file aside instead of overwriting it", () => {
    writeFileSync(path.join(dir, "data.json"), "{ not json");
    const store = createStore(dir);
    store.set("dm-a", 1);
    expect(store.getAll()).toEqual({ "dm-a": 1 });
    expect(readdirSync(dir).some((f) => f.startsWith("data.corrupt-"))).toBe(true);
  });

  it("reports outside edits but not its own writes", async () => {
    const store = createStore(dir);
    store.set("dm-a", 1);
    const seen: unknown[] = [];
    store.onExternalChange((c) => seen.push(c));
    store.watch();
    store.set("dm-own", 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(seen).toEqual([]);
    const outside = JSON.parse(readFileSync(store.file, "utf8"));
    outside.keys["dm-a"] = 99;
    writeFileSync(store.file, JSON.stringify(outside));
    await vi.waitFor(() => expect(seen).toEqual([[{ key: "dm-a", value: 99 }]]), { timeout: 2000 });
    store.close();
    expect(existsSync(store.file)).toBe(true);
  });
});

describe("renderer store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStoreForTests();
    delete window.encounterStore;
  });
  afterEach(() => {
    delete window.encounterStore;
  });

  function fakeBridge(initial: Record<string, unknown>) {
    const file = { ...initial };
    let push: (c: { key: string; value: unknown }[]) => void = () => {};
    window.encounterStore = {
      getAll: async () => ({ ...file }),
      set: async (k, v) => void (file[k] = v),
      remove: async (k) => void delete file[k],
      onChanged: (cb) => ((push = cb), () => {}),
    };
    return { file, push: (c: { key: string; value: unknown }[]) => push(c) };
  }

  it("works from localStorage alone in a plain browser", async () => {
    localStorage.setItem("dm-x", JSON.stringify([1]));
    await storageReady();
    expect(readKey("dm-x")).toEqual([1]);
    writeKey("dm-x", [2]);
    expect(JSON.parse(localStorage.getItem("dm-x")!)).toEqual([2]);
  });

  it("reads legacy bare-text values", async () => {
    localStorage.setItem("dm-name", "2024");
    await storageReady();
    expect(readKey("dm-name")).toBe("2024");
  });

  it("prefers the file, mirrors it to localStorage, and saves writes to both", async () => {
    const { file } = fakeBridge({ "dm-x": ["from file"] });
    localStorage.setItem("dm-x", JSON.stringify(["stale backup"]));
    await storageReady();
    expect(readKey("dm-x")).toEqual(["from file"]);
    expect(JSON.parse(localStorage.getItem("dm-x")!)).toEqual(["from file"]);
    writeKey("dm-x", ["new"]);
    await Promise.resolve();
    expect(file["dm-x"]).toEqual(["new"]);
    expect(JSON.parse(localStorage.getItem("dm-x")!)).toEqual(["new"]);
  });

  it("migrates browser data into an empty file on first read, and restores a deleted file from the backup", async () => {
    const { file } = fakeBridge({});
    localStorage.setItem("dm-x", JSON.stringify(["old data"]));
    await storageReady();
    expect(readKey("dm-x")).toEqual(["old data"]);
    await Promise.resolve();
    expect(file["dm-x"]).toEqual(["old data"]);
  });

  it("applies outside changes and notifies subscribers", async () => {
    const { push } = fakeBridge({ "dm-x": [1] });
    await storageReady();
    const seen = vi.fn();
    subscribeKey("dm-x", seen);
    push([{ key: "dm-x", value: [1, 2] }]);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readKey("dm-x")).toEqual([1, 2]);
    expect(JSON.parse(localStorage.getItem("dm-x")!)).toEqual([1, 2]);
    push([{ key: "dm-x", value: [1, 2] }]);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("falls back to localStorage if the file cannot be read", async () => {
    window.encounterStore = {
      getAll: async () => {
        throw new Error("nope");
      },
      set: async () => {},
      remove: async () => {},
      onChanged: () => () => {},
    };
    localStorage.setItem("dm-x", JSON.stringify([7]));
    await storageReady();
    expect(readKey("dm-x")).toEqual([7]);
  });
});
