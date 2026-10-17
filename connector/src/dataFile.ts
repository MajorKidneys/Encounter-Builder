import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/** Same folder the Encounter Tracker app writes to (see electron/main.cjs). */
export function defaultDataDir(): string {
  return (
    process.env.ENCOUNTER_TRACKER_DATA_DIR ||
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
