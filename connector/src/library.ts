import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LibraryMonster = {
  id: string;
  name: string;
  meta: string;
  cr: number;
  ac: number;
  hp: number;
  hitDice: string;
  srd?: boolean;
  source?: string;
};

/** The app's bundled monster JSON. In this repo it sits at ../../src/data from connector/dist. */
export function defaultLibraryDir(): string {
  return (
    process.env.ENCOUNTER_TRACKER_LIBRARY_DIR ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "data")
  );
}

export function loadLibrary(dir: string = defaultLibraryDir()): LibraryMonster[] {
  const read = (file: string): LibraryMonster[] => {
    try {
      return JSON.parse(readFileSync(path.join(dir, file), "utf8")) as LibraryMonster[];
    } catch {
      return [];
    }
  };
  return [...read("srd-monsters.json"), ...read("a5e-monsters.json")];
}
