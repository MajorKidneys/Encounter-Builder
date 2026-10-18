/**
 * Where saved data lives.
 *
 * In the desktop app the source of truth is a JSON file on disk (see electron/store.cjs), shared
 * with the Claude connector. In a plain browser there is no file, so localStorage is the store.
 * In both cases every write is mirrored to localStorage, so it doubles as a backup: if the file is
 * missing or unreachable, the last mirrored copy is used and written back to the file.
 */
type Change = { key: string; value: unknown };
type Bridge = {
  getAll(): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  onChanged(callback: (changes: Change[]) => void): () => void;
};
declare global {
  interface Window {
    encounterStore?: Bridge;
  }
}

/** key -> serialized JSON, the app's current view of what is saved. */
const cache = new Map<string, string>();
const subscribers = new Map<string, Set<() => void>>();
let bridge: Bridge | undefined;
let ready: Promise<void> | null = null;

function parseTolerant(raw: string): unknown {
  // Older versions saved some values as bare text (the campaign name), not JSON. Everything
  // the app saves is an array, object, or string, so a bare "2024" is a name, not a number.
  try {
    const parsed: unknown = JSON.parse(raw);
    return (parsed !== null && typeof parsed === "object") || typeof parsed === "string"
      ? parsed
      : raw;
  } catch {
    return raw;
  }
}

function mirror(key: string, serialized: string | undefined) {
  try {
    if (serialized === undefined) localStorage.removeItem(key);
    else if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized);
  } catch {
    /* Storage may be unavailable. */
  }
}

const anySubscribers = new Set<(key: string) => void>();

function notify(key: string) {
  subscribers.get(key)?.forEach((callback) => callback());
  anySubscribers.forEach((callback) => callback(key));
}

function applyChange({ key, value }: Change) {
  const serialized = value === undefined ? undefined : JSON.stringify(value);
  if (cache.get(key) === serialized) return;
  if (serialized === undefined) cache.delete(key);
  else cache.set(key, serialized);
  mirror(key, serialized);
  notify(key);
}

/** Resolves once the data file (if there is one) has been read. Safe to call many times. */
export function storageReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ready ??= (async () => {
    const candidate = window.encounterStore;
    if (!candidate) return;
    try {
      const saved = await candidate.getAll();
      for (const [key, value] of Object.entries(saved)) {
        const serialized = JSON.stringify(value);
        cache.set(key, serialized);
        mirror(key, serialized);
      }
      candidate.onChanged((changes) => changes.forEach(applyChange));
      bridge = candidate;
    } catch {
      /* The file is unreachable: carry on with localStorage alone. */
    }
  })();
  return ready;
}

/** The saved value, or undefined if nothing is saved under this key. */
export function readKey(key: string): unknown {
  let serialized = cache.get(key);
  if (serialized === undefined) {
    // Not in the file yet: adopt a copy from the browser backup (first launch after the move,
    // or a deleted data file) and save it to the file.
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* Storage may be unavailable. */
    }
    if (raw === null) return undefined;
    const value = parseTolerant(raw);
    serialized = JSON.stringify(value);
    cache.set(key, serialized);
    mirror(key, serialized);
    void bridge?.set(key, value).catch(() => {});
    return value;
  }
  return JSON.parse(serialized);
}

export function writeKey(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  if (cache.get(key) === serialized) return;
  cache.set(key, serialized);
  mirror(key, serialized);
  void bridge?.set(key, value).catch(() => {});
}

export function removeKey(key: string) {
  if (!cache.has(key)) return;
  cache.delete(key);
  mirror(key, undefined);
  void bridge?.remove(key).catch(() => {});
}

export function subscribeKey(key: string, callback: () => void) {
  let set = subscribers.get(key);
  if (!set) subscribers.set(key, (set = new Set()));
  set.add(callback);
  return () => {
    set.delete(callback);
  };
}

/** Called with the key whenever something outside this window changes a saved key. */
export function subscribeAny(callback: (key: string) => void) {
  anySubscribers.add(callback);
  return () => {
    anySubscribers.delete(callback);
  };
}

/**
 * A Storage-shaped view of the store, for code written against localStorage. Call after
 * storageReady(). Values that are plain text (the old campaign name) read back as that text.
 */
export const storeAdapter: Storage = {
  get length() {
    return cache.size;
  },
  clear() {},
  key: (index: number) => [...cache.keys()][index] ?? null,
  getItem(key: string) {
    const value = readKey(key);
    if (value === undefined) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
  },
  setItem(key: string, raw: string) {
    writeKey(key, parseTolerant(raw));
  },
  removeItem(key: string) {
    removeKey(key);
  },
};

/** For tests: forget everything and re-read the bridge on next use. */
export function resetStoreForTests() {
  cache.clear();
  subscribers.clear();
  anySubscribers.clear();
  bridge = undefined;
  ready = null;
}
