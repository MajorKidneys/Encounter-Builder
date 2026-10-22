/** Viewing preference only. Raw localStorage, never the campaign data file. */
const KEY = "dm-reference-prefs-v1";

export type ReferencePrefs = {
  tooltips: boolean;
  /** Drawer height in pixels. Null uses 35% of the window. */
  height: number | null;
  lastId: string | null;
};

const DEFAULTS: ReferencePrefs = { tooltips: true, height: null, lastId: null };

export function readReferencePrefs(): ReferencePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const record = parsed as Partial<ReferencePrefs>;
    return {
      tooltips: record.tooltips !== false,
      height: typeof record.height === "number" && record.height > 0 ? record.height : null,
      lastId: typeof record.lastId === "string" ? record.lastId : null,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeReferencePrefs(prefs: ReferencePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable */
  }
}
