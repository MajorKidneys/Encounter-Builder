import { useEffect, useState } from "react";
import { Link2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { setCombatantQty, type Combatant, type Encounter } from "@/lib/encounters";
import {
  actNow,
  applyHp,
  hasRolled,
  holdTurn,
  immunities,
  isDown,
  isLive,
  isUnitDead,
  removeCombatant,
  rollInitiative,
  setConditions,
  turnOrder,
  unitLabel,
} from "@/lib/turns";
import { joinsLabel } from "@/lib/prep";
import { Button } from "@/components/ui/button";
import { Tombstone } from "@/components/Tombstone";
import { useWorkspace } from "@/components/Workspace";
import { cn } from "@/lib/utils";
import { RefTerm, RulesHint } from "@/components/reference/RefTerm";
import { useReference } from "@/components/reference/ReferenceLayer";
import { ConditionChips } from "./ConditionChips";
import { DamageHeal, HpMeter } from "./HpControls";

const cols = "grid grid-cols-[minmax(0,1fr)_11.5rem_7.75rem_2rem] items-center gap-x-4";

/** Library name a creature's stats came from, when it differs from what the DM called it. */
export const statSource = (c: Combatant) =>
  c.stats?.srdId && c.stats.name && c.stats.name.toLowerCase() !== c.name.toLowerCase()
    ? c.stats.name
    : null;

export function InitiativeList({
  encounter,
  update,
  selectedId,
  onSelect,
}: {
  encounter: Encounter;
  update: (fn: (e: Encounter) => Encounter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const order = turnOrder(encounter.combatants);
  const rolled = order.filter(hasRolled);
  const waiting = order.filter((c) => !hasRolled(c));
  const updateC = (id: string, fn: (c: Combatant) => Combatant) =>
    update((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)) }));

  const row = (c: Combatant) => (
    <CombatantRow
      key={c.id}
      c={c}
      encounter={encounter}
      selected={selectedId === c.id}
      onSelect={() => onSelect(c.id)}
      update={update}
      updateC={updateC}
    />
  );

  return (
    <div
      role="table"
      aria-label="Initiative order"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        role="row"
        className="grid h-9 grid-cols-[4.5rem_minmax(0,1fr)] items-center border-b border-border pl-3.5 pr-2.5"
      >
        <span className="label-caps">Init</span>
        <div className={cols}>
          <span className="label-caps">Combatant</span>
          <span className="label-caps">Hit points</span>
          <span className="label-caps">Damage · Heal</span>
          <span />
        </div>
      </div>
      {encounter.combatants.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No one here yet. Type a monster or a player's name below to add them.
        </p>
      )}
      {rolled.map(row)}
      {waiting.length > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-sidebar px-3.5 py-2">
          <span className="label-caps">Needs initiative · {waiting.length}</span>
          {waiting.some((c) => !c.isPC) && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() =>
                update((e) => ({
                  ...e,
                  combatants: e.combatants.map((c) =>
                    !c.isPC && !hasRolled(c) ? { ...c, init: rollInitiative(c) } : c,
                  ),
                }))
              }
            >
              Roll for monsters
            </Button>
          )}
        </div>
      )}
      {waiting.map(row)}
    </div>
  );
}

function CombatantRow({
  c,
  encounter,
  selected,
  onSelect,
  update,
  updateC,
}: {
  c: Combatant;
  encounter: Encounter;
  selected: boolean;
  onSelect: () => void;
  update: (fn: (e: Encounter) => Encounter) => void;
  updateC: (id: string, fn: (c: Combatant) => Combatant) => void;
}) {
  const { characters, setCharacters } = useWorkspace();
  const live = isLive(encounter);
  const active = live && encounter.turnId === c.id;
  const { tooltips } = useReference();
  const src = statSource(c);
  const immune = immunities(c);
  const saved = characters.find((person) => person.id === (c.characterId ?? c.npcId)) ?? null;
  const markedDead = Boolean(saved?.dead || c.dead);
  const rememberDeath = (before: Combatant, next: Combatant) => {
    const id = before.characterId ?? before.npcId;
    if (!id || next.isPC || next.maxHp === null) return;
    const wasDead = before.units.length > 0 && before.units.every((u) => u.hp <= 0);
    const nowDead = next.units.length > 0 && next.units.every((u) => u.hp <= 0);
    if (wasDead === nowDead) return;
    setCharacters((all) =>
      all.map((person) => (person.id === id ? { ...person, dead: nowDead } : person)),
    );
  };
  return (
    <div
      role="row"
      data-active={active || undefined}
      className={cn(
        "relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-start border-b border-border py-2.5 pl-3.5 pr-2.5 last:border-b-0",
        active &&
          "bg-primary/[0.07] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
        c.held &&
          "bg-[repeating-linear-gradient(135deg,transparent_0_9px,color-mix(in_oklab,var(--gold)_22%,transparent)_9px_10px)]",
        isDown(c) && "opacity-60",
        selected && !active && "bg-accent/60",
      )}
    >
      <div className="grid justify-items-center gap-1 pr-2">
        <InitInput c={c} onCommit={(init) => updateC(c.id, (x) => ({ ...x, init }))} />
        {active && (
          <RulesHint id="holding-your-action">
            <button
              onClick={() => update(holdTurn)}
              title={tooltips ? undefined : "Hold this turn and act later"}
              className={cn(
                "h-5 rounded-full border border-input bg-card px-2.5 text-[10.5px] font-semibold text-muted-foreground hover:border-primary hover:text-wine-ink",
                tooltips && "underline decoration-dotted underline-offset-2",
              )}
            >
              Hold
            </button>
          </RulesHint>
        )}
        {live && c.held && (
          <button
            onClick={() => update((e) => actNow(e, c.id))}
            title="Act now, before whoever is up"
            className="h-5 whitespace-nowrap rounded-full bg-gold px-2.5 text-[10.5px] font-semibold text-[#2c1c1d] hover:brightness-105"
          >
            Act now
          </button>
        )}
      </div>
      <div className="grid gap-2">
        {c.units.map((u, i) => {
          const label = unitLabel(c, i);
          return (
            <div key={u.id} className={cols}>
              <div className="grid min-w-0 gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    data-drawer-trigger
                    onClick={onSelect}
                    className={cn(
                      "truncate text-left text-[15px] font-semibold hover:text-wine-ink hover:underline hover:underline-offset-4",
                      selected && "text-wine-ink",
                    )}
                  >
                    {label}
                  </button>
                  {(isUnitDead(c, u) || (i === 0 && markedDead)) && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Tombstone />
                      Dead
                    </span>
                  )}
                  {i === 0 && !c.isPC && (
                    <span className="inline-flex shrink-0 items-center rounded-md border border-input">
                      <button
                        type="button"
                        aria-label={`Fewer ${c.name}`}
                        title="Fewer copies"
                        disabled={c.units.length <= 1}
                        onClick={() => updateC(c.id, (x) => setCombatantQty(x, x.units.length - 1))}
                        className="grid h-6 w-6 place-items-center text-muted-foreground hover:bg-accent disabled:opacity-40"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-mono text-[11px] tabular">
                        {c.units.length}
                      </span>
                      <button
                        type="button"
                        aria-label={`More ${c.name}`}
                        title="More copies"
                        disabled={c.units.length >= 50}
                        onClick={() => updateC(c.id, (x) => setCombatantQty(x, x.units.length + 1))}
                        className="grid h-6 w-6 place-items-center text-muted-foreground hover:bg-accent disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {i === 0 && src && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title={`Uses ${src} stats`}
                    >
                      <Link2 className="h-3 w-3" />
                      {src}
                    </span>
                  )}
                  {i === 0 && (c.countNote || joinsLabel(c.joins)) && (
                    <span className="text-xs text-muted-foreground">
                      {[c.countNote, joinsLabel(c.joins)].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {i === 0 && c.isPC && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                      PC
                    </span>
                  )}
                  {i === 0 && active && (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary-foreground">
                      Turn
                    </span>
                  )}
                  {i === 0 && c.held && (
                    <span className="rounded bg-gold/25 px-1.5 py-0.5 font-mono text-[10px] text-gold-foreground">
                      <RefTerm id="holding-your-action">Holding</RefTerm>
                    </span>
                  )}
                </div>
                <ConditionChips
                  name={label}
                  conditions={u.conditions ?? []}
                  immune={immune}
                  onChange={(next) => updateC(c.id, (x) => setConditions(x, u.id, () => next))}
                />
              </div>
              <div>
                {c.maxHp === null ? (
                  <span className="text-[12.5px] text-muted-foreground">
                    {c.isPC ? "Tracked by player" : "No HP set"}
                  </span>
                ) : (
                  <HpMeter hp={u.hp} max={c.maxHp} />
                )}
              </div>
              <div>
                {c.maxHp !== null && (
                  <DamageHeal
                    label={label}
                    onApply={(delta) => {
                      const { combatant, result } = applyHp(c, u.id, delta);
                      updateC(c.id, () => combatant);
                      rememberDeath(c, combatant);
                      if (result?.concentrationDc)
                        toast(`Concentration save: DC ${result.concentrationDc}`, {
                          description: `${label} took ${delta} damage. Con save to keep concentrating.`,
                        });
                      if (result?.concentrationLost)
                        toast(`${label} is down`, {
                          description: `Concentration on ${result.concentrationLost} ends.`,
                        });
                    }}
                  />
                )}
              </div>
              <button
                aria-label={`Remove ${label}`}
                title={`Remove ${label}`}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 [div[role=row]:hover_&]:opacity-100"
                onClick={() =>
                  c.units.length <= 1
                    ? update((e) => removeCombatant(e, c.id))
                    : updateC(c.id, (x) => {
                        const units = x.units.filter((y) => y.id !== u.id);
                        return { ...x, units, qty: units.length };
                      })
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Looks like plain text until hovered; blank means "hasn't rolled yet". Enter jumps to the next empty slot. */
function InitInput({ c, onCommit }: { c: Combatant; onCommit: (init: number | null) => void }) {
  const [v, setV] = useState(c.init === null || c.init === undefined ? "" : String(c.init));
  useEffect(() => setV(c.init === null || c.init === undefined ? "" : String(c.init)), [c.init]);
  const commit = () => {
    const n = parseInt(v, 10);
    const next = v.trim() === "" || Number.isNaN(n) ? null : n;
    if (next !== c.init) onCommit(next);
  };
  const empty = v.trim() === "";
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      inputMode="numeric"
      placeholder="roll"
      data-init-input={c.id}
      data-empty={empty || undefined}
      aria-label={`Initiative for ${c.name}`}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        commit();
        // After the list re-sorts, move to the next creature still waiting on a roll.
        setTimeout(() => {
          const next = [...document.querySelectorAll<HTMLInputElement>("input[data-empty]")].find(
            (el) => el.dataset["initInput"] !== c.id,
          );
          if (next) next.focus();
          else (e.target as HTMLInputElement).blur();
        }, 30);
      }}
      className={cn(
        "h-9 w-[3.25rem] rounded-lg border border-transparent bg-transparent text-center font-mono text-xl font-medium tabular outline-none hover:border-input hover:bg-background focus:border-primary focus:bg-card",
        empty && "border-dashed border-primary bg-primary/[0.06] text-sm placeholder:text-wine-ink",
      )}
    />
  );
}
