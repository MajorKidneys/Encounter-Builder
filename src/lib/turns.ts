import { type Combatant, type Condition, type Encounter, type Unit, uid } from "./encounters";
import type { ResetOn } from "./monsters";

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

export const CONDITION_RULES: Record<string, string> = {
  Blinded: "Can't see. Attacks against it have advantage; its attacks have disadvantage.",
  Charmed: "Can't attack the charmer. The charmer has advantage on social checks against it.",
  Deafened: "Can't hear. Fails checks that rely on hearing.",
  Frightened:
    "Disadvantage on checks and attacks while the source is in sight. Can't move closer to it.",
  Grappled: "Speed is 0.",
  Incapacitated: "Can't take actions or reactions.",
  Invisible: "Attacks against it have disadvantage; its attacks have advantage.",
  Paralyzed:
    "Incapacitated, can't move or speak. Fails Str and Dex saves. Hits from within 5 ft are crits.",
  Petrified: "Turned to stone. Incapacitated, resistant to all damage.",
  Poisoned: "Disadvantage on attack rolls and ability checks.",
  Prone: "Can only crawl. Disadvantage on attacks. Melee attacks against it have advantage.",
  Restrained: "Speed 0. Disadvantage on attacks and Dex saves. Attacks against it have advantage.",
  Stunned:
    "Incapacitated, can barely speak. Fails Str and Dex saves. Attacks against it have advantage.",
  Unconscious: "Incapacitated and prone, drops what it holds. Hits from within 5 ft are crits.",
  Exhaustion: "Six levels. Each level adds a further penalty; level 6 is death.",
  Concentrating: "When it takes damage, Con save DC 10 or half the damage, whichever is higher.",
};

/** Copy labels: a single creature keeps its name, groups become "Orc A", "Orc B"… */
export const unitLabel = (c: Combatant, i: number) =>
  c.units.length > 1 ? `${c.name} ${String.fromCharCode(65 + (i % 26))}` : c.name;

export const hasRolled = (c: Combatant) => c.init !== null && c.init !== undefined;

/** Down = a tracked monster whose every copy is at 0. PCs and untracked HP are never skipped. */
export const isDown = (c: Combatant) =>
  !c.isPC && c.maxHp !== null && c.units.length > 0 && c.units.every((u) => u.hp <= 0);

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

/** Start of a creature's turn: timed conditions tick down (and ask before leaving), turn resources refill. */
function beginTurn(c: Combatant): Combatant {
  const units = c.units.map((u) => ({
    ...u,
    conditions: u.conditions?.map((k) => {
      if (typeof k.rounds !== "number" || k.expired) return k;
      const rounds = k.rounds - 1;
      return rounds <= 0 ? { ...k, rounds: 0, expired: true } : { ...k, rounds };
    }),
  }));
  return resetResources({ ...c, units }, ["turn"]);
}

function mapC(e: Encounter, id: string, fn: (c: Combatant) => Combatant): Encounter {
  return { ...e, combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

export function startCombat(e: Encounter): Encounter {
  const first = turnOrder(e.combatants).find(canAct);
  if (!first) return e;
  return mapC({ ...e, round: 1, turnId: first.id }, first.id, beginTurn);
}

export function endCombat(e: Encounter): Encounter {
  return {
    ...e,
    round: 0,
    turnId: null,
    combatants: e.combatants.map((c) => (c.held ? { ...c, held: false } : c)),
  };
}

export function nextTurn(e: Encounter): Encounter {
  if (!isLive(e)) return startCombat(e);
  const order = turnOrder(e.combatants);
  const from = order.findIndex((c) => c.id === e.turnId);
  for (let s = 1; s <= order.length; s++) {
    const j = (from + s) % order.length;
    const c = order[j]!;
    if (!canAct(c)) continue;
    const wrapped = j <= from;
    let next: Encounter = { ...e, turnId: c.id };
    if (wrapped)
      next = {
        ...next,
        round: (e.round ?? 1) + 1,
        combatants: next.combatants.map((x) => resetResources(x, ["round"])),
      };
    return mapC(next, c.id, beginTurn);
  }
  return e;
}

export function prevTurn(e: Encounter): Encounter {
  if (!isLive(e)) return e;
  const order = turnOrder(e.combatants);
  const from = order.findIndex((c) => c.id === e.turnId);
  for (let s = 1; s <= order.length; s++) {
    const j = (((from - s) % order.length) + order.length) % order.length;
    const c = order[j]!;
    if (!canAct(c)) continue;
    const wrapped = j >= from;
    return { ...e, turnId: c.id, round: wrapped ? Math.max(1, (e.round ?? 1) - 1) : e.round };
  }
  return e;
}

/** The active creature delays: it leaves the rotation until it chooses to act. */
export function holdTurn(e: Encounter): Encounter {
  if (!isLive(e) || !e.turnId) return e;
  return nextTurn(mapC(e, e.turnId, (c) => ({ ...c, held: true })));
}

/** A held creature acts now: it takes the current initiative, slots in just before whoever is up, and becomes active. */
export function actNow(e: Encounter, id: string): Encounter {
  const me = e.combatants.find((c) => c.id === id);
  const cur = e.combatants.find((c) => c.id === e.turnId);
  if (!me) return e;
  if (!cur || cur.id === id) return { ...mapC(e, id, (c) => ({ ...c, held: false })), turnId: id };
  const moved = { ...me, held: false, init: cur.init };
  const rest = e.combatants.filter((c) => c.id !== id);
  const at = rest.findIndex((c) => c.id === cur.id);
  return { ...e, turnId: id, combatants: [...rest.slice(0, at), moved, ...rest.slice(at)] };
}

/** Removing the active creature hands the turn on first. */
export function removeCombatant(e: Encounter, id: string): Encounter {
  const handed = e.turnId === id && isLive(e) ? nextTurn(e) : e;
  const out = { ...handed, combatants: handed.combatants.filter((c) => c.id !== id) };
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
