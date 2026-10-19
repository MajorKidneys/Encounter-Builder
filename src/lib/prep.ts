import type { Encounter, RoundBeat } from "./encounters";

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
