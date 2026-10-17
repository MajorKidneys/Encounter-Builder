import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

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

function notify(key: string) {
  subscribers.get(key)?.forEach((callback) => callback());
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

export function subscribeKey(key: string, callback: () => void) {
  let set = subscribers.get(key);
  if (!set) subscribers.set(key, (set = new Set()));
  set.add(callback);
  return () => {
    set.delete(callback);
  };
}

/**
 * useState that loads from and saves to the store. `initial` shows until the store has been read;
 * `fallback` is used if nothing is saved yet. Changes made outside the app (by the connector)
 * replace the value while the app is open.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  options: { fallback?: () => T; isValid?: (value: unknown) => boolean } = {},
): readonly [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    const pick = (): T => {
      const { fallback, isValid } = optionsRef.current;
      const stored = readKey(key);
      if (stored !== undefined && (!isValid || isValid(stored))) return stored as T;
      return fallback ? fallback() : initial;
    };
    void storageReady().then(() => {
      if (!alive) return;
      setValue(pick());
      setLoaded(true);
      unsubscribe = subscribeKey(key, () => setValue(pick()));
    });
    return () => {
      alive = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loaded) writeKey(key, value);
  }, [value, loaded, key]);

  return [value, setValue, loaded] as const;
}

/** For tests: forget everything and re-read the bridge on next use. */
export function resetStoreForTests() {
  cache.clear();
  subscribers.clear();
  bridge = undefined;
  ready = null;
}
