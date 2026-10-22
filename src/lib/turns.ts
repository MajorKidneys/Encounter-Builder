import { type Combatant, type Condition, type Encounter, type Unit, uid } from "./encounters";
import type { ResetOn } from "./monsters";
import { conditionEntryId, getEntry } from "./reference";

/** Standard 5e conditions plus the two the table tracks constantly. */
export const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Exhaustion",
  "Concentrating",
] as const;

/** Tooltip lines, taken from the glossary so the wording lives in one place. */
export const CONDITION_RULES: Record<string, string> = Object.fromEntries(
  CONDITIONS.map((name) => [name, getEntry(conditionEntryId(name))?.short ?? ""]),
);

/** Copy labels: a single creature keeps its name, groups become "Orc A", "Orc B"… */
export const unitLabel = (c: Combatant, i: number) =>
  c.units.length > 1 ? `${c.name} ${String.fromCharCode(65 + (i % 26))}` : c.name;

export const hasRolled = (c: Combatant) => c.init !== null && c.init !== undefined;

/** Down = a tracked monster whose every copy is at 0. PCs and untracked HP are never skipped. */
export const isDown = (c: Combatant) =>
  !c.isPC && c.maxHp !== null && c.units.length > 0 && c.units.every((u) => u.hp <= 0);

/** One copy is dead when its hit points are tracked and have reached 0. */
export const isUnitDead = (c: Combatant, u: Unit) => c.maxHp !== null && u.hp <= 0;

export const canAct = (c: Combatant) => hasRolled(c) && !isDown(c) && !c.held;

/** Rolled creatures by initiative (ties keep their list order), then everyone still waiting to roll. */
export function turnOrder(list: Combatant[]): Combatant[] {
  const rolled = list.filter(hasRolled).sort((a, b) => (b.init as number) - (a.init as number));
  return [...rolled, ...list.filter((c) => !hasRolled(c))];
}

export const isLive = (e: Encounter) => (e.round ?? 0) > 0;

function resetResources(c: Combatant, kinds: ResetOn[]): Combatant {
  if (!c.stats?.resources.some((r) => kinds.includes(r.reset))) return c;
  return {
    ...c,
    stats: {
      ...c.stats,
      resources: c.stats.resources.map((r) =>
        kinds.includes(r.reset) ? { ...r, current: r.max } : r,
      ),
    },
  };
}

type CondRef = { unitId: string; conditionId: string };
type ResourceSnap = { resourceId: string; current: number };
type RoundResourceSnap = { combatantId: string; resourceId: string; current: number };

/** One undoable combat step. Next/Hold push a "step"; Act now pushes an "act". */
export type TurnFrame =
  | {
      type: "step";
      fromId: string;
      /** `held` on the creature who just acted, before this step changed it. */
      fromHeld: boolean;
      toId: string;
      prevRound: number;
      /** Timed conditions on `fromId` that counted down. */
      decremented: CondRef[];
      /** Those that hit 0 and asked to be removed. */
      expired: CondRef[];
      /** Turn resources on `toId` before they refilled. */
      turnResources: ResourceSnap[];
      /** Round resources before a new round refilled them. */
      roundResources?: RoundResourceSnap[] | undefined;
    }
  | {
      type: "act";
      id: string;
      prevTurnId: string | null | undefined;
      prevInit: number | null;
      prevHeld: boolean;
      prevIndex: number;
    };

function mapC(e: Encounter, id: string, fn: (c: Combatant) => Combatant): Encounter {
  return { ...e, combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

function remember(e: Encounter, frame: TurnFrame): Encounter {
  return { ...e, turnHistory: [...(e.turnHistory ?? []), frame] };
}

/** End of a creature's turn: each timed condition counts down, and a finished one asks to be removed. */
function endTurn(c: Combatant): {
  combatant: Combatant;
  decremented: CondRef[];
  expired: CondRef[];
} {
  const decremented: CondRef[] = [];
  const expired: CondRef[] = [];
  const units = c.units.map((u) => ({
    ...u,
    conditions: u.conditions?.map((k) => {
      if (typeof k.rounds !== "number" || k.expired || k.rounds <= 0) return k;
      decremented.push({ unitId: u.id, conditionId: k.id });
      const rounds = k.rounds - 1;
      if (rounds <= 0) {
        expired.push({ unitId: u.id, conditionId: k.id });
        return { ...k, rounds: 0, expired: true };
      }
      return { ...k, rounds };
    }),
  }));
  return { combatant: { ...c, units }, decremented, expired };
}

/** Start of a creature's turn: turn resources refill. Durations are counted at the end of the turn. */
function beginTurn(c: Combatant): { combatant: Combatant; turnResources: ResourceSnap[] } {
  const turnResources = (c.stats?.resources ?? [])
    .filter((r) => r.reset === "turn")
    .map((r) => ({ resourceId: r.id, current: r.current }));
  return { combatant: resetResources(c, ["turn"]), turnResources };
}

function mapConditions(c: Combatant, refs: CondRef[], fn: (k: Condition) => Condition): Combatant {
  if (!refs.length) return c;
  const byUnit = new Map<string, Set<string>>();
  for (const ref of refs) {
    const ids = byUnit.get(ref.unitId) ?? new Set<string>();
    ids.add(ref.conditionId);
    byUnit.set(ref.unitId, ids);
  }
  return {
    ...c,
    units: c.units.map((u) => {
      const ids = byUnit.get(u.id);
      if (!ids || !u.conditions) return u;
      return { ...u, conditions: u.conditions.map((k) => (ids.has(k.id) ? fn(k) : k)) };
    }),
  };
}

function restoreResources(c: Combatant, snaps: ResourceSnap[]): Combatant {
  if (!c.stats || !snaps.length) return c;
  const prev = new Map(snaps.map((s) => [s.resourceId, s.current]));
  return {
    ...c,
    stats: {
      ...c.stats,
      resources: c.stats.resources.map((r) =>
        prev.has(r.id) ? { ...r, current: prev.get(r.id)! } : r,
      ),
    },
  };
}

/** Advance to the next creature who can act, remembering enough to undo this step. */
function advance(e: Encounter, fromHeld: boolean): Encounter {
  const current = e.combatants.find((c) => c.id === e.turnId);
  if (!current) return e;
  const order = turnOrder(e.combatants);
  const fromIdx = order.findIndex((c) => c.id === current.id);
  for (let s = 1; s <= order.length; s++) {
    const j = (fromIdx + s) % order.length;
    const candidate = order[j];
    if (!candidate || !canAct(candidate)) continue;

    const ended = endTurn(current);
    let combatants = e.combatants.map((c) => (c.id === current.id ? ended.combatant : c));
    const prevRound = e.round ?? 1;
    const wrapped = j <= fromIdx;
    let round = prevRound;
    let roundResources: RoundResourceSnap[] | undefined;
    if (wrapped) {
      round = prevRound + 1;
      roundResources = combatants.flatMap((c) =>
        (c.stats?.resources ?? [])
          .filter((r) => r.reset === "round")
          .map((r) => ({ combatantId: c.id, resourceId: r.id, current: r.current })),
      );
      combatants = combatants.map((c) => resetResources(c, ["round"]));
    }
    const target = combatants.find((c) => c.id === candidate.id) ?? candidate;
    const begun = beginTurn(target);
    combatants = combatants.map((c) => (c.id === target.id ? begun.combatant : c));
    return remember(
      { ...e, combatants, round, turnId: target.id },
      {
        type: "step",
        fromId: current.id,
        fromHeld,
        toId: target.id,
        prevRound,
        decremented: ended.decremented,
        expired: ended.expired,
        turnResources: begun.turnResources,
        ...(roundResources?.length ? { roundResources } : {}),
      },
    );
  }
  return e;
}

function undoStep(e: Encounter, frame: Extract<TurnFrame, { type: "step" }>): Encounter {
  const roundSnaps = new Map<string, ResourceSnap[]>();
  for (const snap of frame.roundResources ?? []) {
    const list = roundSnaps.get(snap.combatantId) ?? [];
    list.push({ resourceId: snap.resourceId, current: snap.current });
    roundSnaps.set(snap.combatantId, list);
  }
  const combatants = e.combatants.map((c) => {
    let next = c;
    if (c.id === frame.toId) next = restoreResources(next, frame.turnResources);
    const rounds = roundSnaps.get(c.id);
    if (rounds) next = restoreResources(next, rounds);
    if (c.id === frame.fromId) {
      next = { ...next, held: frame.fromHeld };
      next = mapConditions(next, frame.decremented, (k) =>
        typeof k.rounds === "number" ? { ...k, rounds: k.rounds + 1 } : k,
      );
      next = mapConditions(next, frame.expired, (k) => (k.expired ? { ...k, expired: false } : k));
    }
    return next;
  });
  return { ...e, combatants, turnId: frame.fromId, round: frame.prevRound };
}

function undoAct(e: Encounter, frame: Extract<TurnFrame, { type: "act" }>): Encounter {
  const index = e.combatants.findIndex((c) => c.id === frame.id);
  const me = e.combatants[index];
  if (!me) return { ...e, turnId: frame.prevTurnId };
  const restored = { ...me, held: frame.prevHeld, init: frame.prevInit };
  const rest = e.combatants.filter((c) => c.id !== frame.id);
  const at = Math.max(0, Math.min(frame.prevIndex, rest.length));
  return {
    ...e,
    turnId: frame.prevTurnId,
    combatants: [...rest.slice(0, at), restored, ...rest.slice(at)],
  };
}

export function startCombat(e: Encounter): Encounter {
  const first = turnOrder(e.combatants).find(canAct);
  if (!first) return e;
  const begun = beginTurn(first);
  return mapC(
    { ...e, round: 1, turnId: first.id, turnHistory: [] },
    first.id,
    () => begun.combatant,
  );
}

export function endCombat(e: Encounter): Encounter {
  return {
    ...e,
    round: 0,
    turnId: null,
    turnHistory: [],
    combatants: e.combatants.map((c) => (c.held ? { ...c, held: false } : c)),
  };
}

export function nextTurn(e: Encounter): Encounter {
  if (!isLive(e)) return startCombat(e);
  const current = e.combatants.find((c) => c.id === e.turnId);
  if (!current) return e;
  return advance(e, !!current.held);
}

export function prevTurn(e: Encounter): Encounter {
  if (!isLive(e)) return e;
  const history = e.turnHistory ?? [];
  const frame = history[history.length - 1];
  if (!frame) return e;
  const rest = { ...e, turnHistory: history.slice(0, -1) };
  return frame.type === "act" ? undoAct(rest, frame) : undoStep(rest, frame);
}

/** The active creature delays: it leaves the rotation until it chooses to act. */
export function holdTurn(e: Encounter): Encounter {
  if (!isLive(e) || !e.turnId) return e;
  const id = e.turnId;
  const wasHeld = !!e.combatants.find((c) => c.id === id)?.held;
  return advance(
    mapC(e, id, (c) => ({ ...c, held: true })),
    wasHeld,
  );
}

/** A held creature acts now: it takes the current initiative, slots in just before whoever is up, and becomes active. */
export function actNow(e: Encounter, id: string): Encounter {
  const prevIndex = e.combatants.findIndex((c) => c.id === id);
  const me = e.combatants[prevIndex];
  const cur = e.combatants.find((c) => c.id === e.turnId);
  if (!me) return e;
  const frame: TurnFrame = {
    type: "act",
    id,
    prevTurnId: e.turnId,
    prevInit: me.init,
    prevHeld: !!me.held,
    prevIndex,
  };
  const moved =
    !cur || cur.id === id
      ? { ...mapC(e, id, (c) => ({ ...c, held: false })), turnId: id }
      : (() => {
          const nextMe = { ...me, held: false, init: cur.init };
          const rest = e.combatants.filter((c) => c.id !== id);
          const at = rest.findIndex((c) => c.id === cur.id);
          return {
            ...e,
            turnId: id,
            combatants: [...rest.slice(0, at), nextMe, ...rest.slice(at)],
          };
        })();
  return remember(moved, frame);
}

/** Removing the active creature hands the turn on first. Rewind stops at the removal. */
export function removeCombatant(e: Encounter, id: string): Encounter {
  const handed = e.turnId === id && isLive(e) ? nextTurn(e) : e;
  const out = {
    ...handed,
    turnHistory: [],
    combatants: handed.combatants.filter((c) => c.id !== id),
  };
  return out.turnId === id ? { ...out, turnId: null, round: 0 } : out;
}

export type DamageResult = { unit: Unit; concentrationDc?: number; concentrationLost?: string };

/** Applies damage (positive) or healing (negative) to one copy and reports what the DM needs to know. */
export function applyHp(
  c: Combatant,
  unitId: string,
  delta: number,
): { combatant: Combatant; result: DamageResult | null } {
  const max = c.maxHp ?? 0;
  let result: DamageResult | null = null;
  const units = c.units.map((u) => {
    if (u.id !== unitId) return u;
    const wasDown = u.hp <= 0;
    const hp = Math.min(max, Math.max(0, u.hp - delta));
    let conditions = u.conditions ?? [];
    const conc = conditions.find((k) => k.name === "Concentrating");
    const r: DamageResult = { unit: u };
    if (delta > 0 && conc) {
      if (hp === 0) {
        r.concentrationLost = conc.note || "the spell";
        conditions = conditions.filter((k) => k !== conc);
      } else r.concentrationDc = Math.max(10, Math.floor(delta / 2));
    }
    if (!c.isPC && c.maxHp !== null) {
      if (hp === 0 && !conditions.some((k) => k.name === "Unconscious"))
        conditions = [...conditions, { id: uid(), name: "Unconscious" }];
      if (wasDown && hp > 0) conditions = conditions.filter((k) => k.name !== "Unconscious");
    }
    const next = { ...u, hp, conditions };
    r.unit = next;
    result = r;
    return next;
  });
  return { combatant: { ...c, units }, result };
}

export function setConditions(
  c: Combatant,
  unitId: string,
  fn: (k: Condition[]) => Condition[],
): Combatant {
  return {
    ...c,
    units: c.units.map((u) => (u.id === unitId ? { ...u, conditions: fn(u.conditions ?? []) } : u)),
  };
}

/** Condition names this creature is immune to, read from its stat block. */
export function immunities(c: Combatant): string[] {
  const text = c.stats?.condImmune?.toLowerCase() ?? "";
  return CONDITIONS.filter((k) => text.includes(k.toLowerCase()));
}

/** Library HP is "avg"; Dex modifier feeds initiative rolls. */
export function rollInitiative(
  c: Combatant,
  d20: () => number = () => Math.ceil(Math.random() * 20),
): number {
  const dex = c.stats?.abilities?.[1] ?? 10;
  return d20() + Math.floor((dex - 10) / 2);
}
