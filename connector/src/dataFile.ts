import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Same folder the Encounter Tracker app writes to (see electron/main.cjs). */
export function defaultDataDir(): string {
  return (
    process.env["ENCOUNTER_TRACKER_DATA_DIR"] ||
    path.join(homedir(), "Library", "Application Support", "Encounter Tracker")
  );
}

export type Keys = Record<string, unknown>;

/** Reads every saved key from the app's data file. Throws a plain-language error if it can't. */
export function readKeys(dir: string = defaultDataDir()): Keys {
  const file = path.join(dir, "data.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `No Encounter Tracker data file at ${file}. Open the Encounter Tracker app once so it creates it.`,
      );
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`The data file at ${file} is not valid JSON, so nothing was read.`);
  }
  const keys = (parsed as { keys?: unknown } | null)?.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) {
    throw new Error(`The data file at ${file} is not in the expected format.`);
  }
  return keys as Keys;
}

/**
 * Saves some keys into the data file without touching the rest. The file is re-read right before
 * writing and replaced atomically (temp file + rename), the same way the app writes it, so an edit
 * the GM just made in the app is kept.
 */
export function writeKeys(updates: Keys, dir: string = defaultDataDir()): void {
  const file = path.join(dir, "data.json");
  const current = readKeys(dir);
  const next = { ...current, ...updates };
  const text = JSON.stringify(
    { version: 1, updatedAt: new Date().toISOString(), keys: next },
    null,
    2,
  );
  const tmp = path.join(dir, `.data.json.connector-${process.pid}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}
