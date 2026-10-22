import { uid, type Encounter, type LootItem, type RoundBeat } from "./encounters";

/** Does this beat apply in `round`? A number matches that round; "6+" matches round 6 and every round after. */
export function beatApplies(beat: RoundBeat, round: number): boolean {
  if (typeof beat.round === "number") return beat.round === round;
  const text = beat.round.trim();
  const open = text.match(/^(\d+)\s*\+$/);
  if (open) return round >= Number(open[1]);
  return Number(text) === round;
}

/** Beats to show for `round`: exact-round beats first, then "this round and after" ones. */
export function beatsForRound(beats: RoundBeat[] | undefined, round: number): RoundBeat[] {
  const hits = (beats ?? []).filter((b) => beatApplies(b, round));
  return [
    ...hits.filter((b) => typeof b.round === "number"),
    ...hits.filter((b) => typeof b.round !== "number"),
  ];
}

export const beatLabel = (beat: RoundBeat) =>
  typeof beat.round === "number"
    ? `Round ${beat.round}`
    : /\+$/.test(beat.round.trim())
      ? `Round ${beat.round.trim()}`
      : `Round ${beat.round}`;

/** True when there is anything prep-related to show above the initiative list. */
export function hasPrep(e: Encounter): boolean {
  return Boolean(
    e.session ||
    e.location ||
    e.status === "dormant" ||
    e.tactics ||
    e.morale ||
    e.beats?.length ||
    e.roomLoot?.length,
  );
}

/** Joins text for a group, or null when it simply starts with everyone. */
export function joinsLabel(joins: "start" | "manual" | number | undefined): string | null {
  if (joins === undefined || joins === "start") return null;
  return joins === "manual" ? "Joins when you call them" : `Joins round ${joins}`;
}

/** A beat's round as typed: an integer from 1, or "N+" for that round and every one after. */
export function parseBeatRound(
  input: string,
): { ok: true; round: number | string } | { ok: false; error: string } {
  const text = input.trim();
  if (/^\d+$/.test(text) && Number(text) >= 1) return { ok: true, round: Number(text) };
  const open = text.match(/^(\d+)\s*\+$/);
  if (open && Number(open[1]) >= 1) return { ok: true, round: `${Number(open[1])}+` };
  return { ok: false, error: "Use a round like 2, or 6+ for round 6 and every one after." };
}

/** Room keys are short ("U3"). Anything longer is prose that belongs in the setting. */
export const LONG_LOCATION = 40;
export const isLongLocation = (location: string | undefined) =>
  (location?.length ?? 0) > LONG_LOCATION;

/** First non-blank line, for a collapsed card. */
export function firstLine(text: string | undefined): string {
  return (
    (text ?? "")
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? ""
  );
}

/** "Tactics · Morale · 2 loot" for the collapsed prep card. */
export function prepSummary(e: Encounter): string {
  const loot = e.roomLoot?.length ?? 0;
  const beats = e.beats?.length ?? 0;
  return [
    e.status === "dormant" && "Dormant",
    e.tactics && "Tactics",
    e.morale && "Morale",
    beats > 0 && `${beats} ${beats === 1 ? "beat" : "beats"}`,
    loot > 0 && `${loot} loot`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type PrepDraft = {
  session: string;
  location: string;
  tactics: string;
  morale: string;
  dormant: boolean;
  trigger: string;
  beats: { key: string; round: string; text: string }[];
  loot: { key: string; id: string | null; name: string; detail: string }[];
};

export function draftFromEncounter(e: Encounter): PrepDraft {
  return {
    session: e.session ?? "",
    location: e.location ?? "",
    tactics: e.tactics ?? "",
    morale: e.morale ?? "",
    dormant: e.status === "dormant",
    trigger: e.trigger ?? "",
    beats: (e.beats ?? []).map((b, i) => ({ key: `b${i}`, round: String(b.round), text: b.text })),
    loot: (e.roomLoot ?? []).map((l) => ({
      key: l.id,
      id: l.id,
      name: l.name,
      detail: l.condition ?? "",
    })),
  };
}

/** Problems that stop a save, keyed by beat row. */
export function draftErrors(draft: PrepDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const b of draft.beats) {
    if (!b.text.trim() && !b.round.trim()) continue;
    const parsed = parseBeatRound(b.round);
    if (!parsed.ok) errors[b.key] = parsed.error;
  }
  return errors;
}

const blank = (text: string) => text.trim() || undefined;

/**
 * Writes a draft back onto an encounter. Empty text becomes a missing field, so `hasPrep`
 * and the connector stay clean. Loot the GM did not touch keeps its value, harvest check,
 * and collected state.
 */
export function applyDraft(e: Encounter, draft: PrepDraft): Encounter {
  const { status, roomLoot, ...kept } = e;
  const {
    session: _s,
    location: _l,
    tactics: _t,
    morale: _m,
    trigger: _g,
    beats: _b,
    ...rest
  } = kept;
  void [_s, _l, _t, _m, _g, _b];
  const next: Encounter = { ...rest };
  const set = <K extends "session" | "location" | "tactics" | "morale" | "trigger">(
    key: K,
    value: string,
  ) => {
    const v = blank(value);
    if (v !== undefined) next[key] = v;
  };
  set("session", draft.session);
  set("location", draft.location);
  set("tactics", draft.tactics);
  set("morale", draft.morale);
  set("trigger", draft.trigger);
  if (draft.dormant) next.status = "dormant";
  else if (status && status !== "dormant") next.status = status;
  else if (status === "dormant") next.status = "staged";

  const rounds = draft.beats.flatMap((b) => {
    const parsed = parseBeatRound(b.round);
    return b.text.trim() && parsed.ok ? [{ round: parsed.round, text: b.text.trim() }] : [];
  });
  if (rounds.length) next.beats = rounds;

  const before = new Map((roomLoot ?? []).map((l) => [l.id, l]));
  const loot = draft.loot.flatMap((row) => {
    const name = row.name.trim();
    if (!name) return [];
    const old = row.id ? before.get(row.id) : undefined;
    const condition = blank(row.detail);
    const item: LootItem = old ? { ...old, name } : { id: uid(), name, taken: false };
    if (condition !== undefined) item.condition = condition;
    else delete item.condition;
    return [item];
  });
  if (loot.length) next.roomLoot = loot;
  return next;
}
