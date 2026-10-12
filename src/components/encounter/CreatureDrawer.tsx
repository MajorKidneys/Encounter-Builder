import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { type Combatant, lootTotalGp, makeUnits } from "@/lib/encounters";
import { immunities, setConditions, unitLabel } from "@/lib/turns";
import { MonsterPanel } from "@/components/MonsterPanel";
import { GearLoot } from "@/components/GearLoot";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/Workspace";
import { CharacterUses } from "@/components/party/CharacterUses";
import { ConditionChips } from "./ConditionChips";
import { HpMeter } from "./HpControls";
import { statSource } from "./InitiativeList";

const num = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));

/** Everything about one combatant: copies and conditions on top, then collapsible stats, gear, loot and notes. */
export function CreatureDrawer({
  c,
  onClose,
  update,
}: {
  c: Combatant;
  onClose: () => void;
  update: (fn: (c: Combatant) => Combatant) => void;
}) {
  const { characters, setCharacters } = useWorkspace();
  const saved = characters.find((person) => person.id === c.characterId) ?? null;
  const [unitIdx, setUnitIdx] = useState(0);
  useEffect(() => setUnitIdx(0), [c.id]);
  const idx = Math.min(unitIdx, c.units.length - 1);
  const unit = c.units[idx];
  const src = statSource(c);
  const total = lootTotalGp(c.currency);
  const setQty = (q: number) =>
    update((x) => {
      const qty = Math.max(1, q);
      return {
        ...x,
        qty,
        units:
          qty > x.units.length
            ? [...x.units, ...makeUnits(qty - x.units.length, x.maxHp)]
            : x.units.slice(0, qty),
      };
    });

  return (
    <aside
      data-drawer-panel
      aria-label={`${c.name} details`}
      className="flex w-[27rem] shrink-0 flex-col border-l border-border bg-background shadow-[-18px_0_40px_-28px_rgba(0,0,0,.45)]"
    >
      <div className="grid gap-3 border-b border-border px-5 pb-3.5 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="label-caps">
              {c.isPC
                ? "Player character"
                : c.units.length > 1
                  ? `Monster · ${c.units.length} copies`
                  : "Monster"}
            </p>
            <input
              aria-label="Name"
              value={c.name}
              onChange={(e) => update((x) => ({ ...x, name: e.target.value }))}
              className="-ml-1 mt-0.5 w-full rounded-md border border-transparent bg-transparent px-1 font-display text-[26px] font-bold leading-tight tracking-tight outline-none hover:border-input focus:border-primary focus:bg-card"
            />
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {src ? (
                <>
                  Stats:{" "}
                  <b className="rounded bg-teal/15 px-1.5 py-px font-semibold text-teal-foreground">
                    {src}
                  </b>
                  {c.stats?.meta && <span> · {c.stats.meta}</span>}
                </>
              ) : c.stats?.meta ? (
                c.stats.meta
              ) : c.stats ? (
                "Custom stats"
              ) : (
                "No stats linked"
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
          <label className="flex items-center gap-2">
            <Switch checked={c.isPC} onCheckedChange={(v) => update((x) => ({ ...x, isPC: v }))} />{" "}
            Player character
          </label>
          <span className="flex items-center gap-1.5">
            Copies
            <span className="inline-flex items-center rounded-md border border-input">
              <button
                className="grid h-7 w-7 place-items-center hover:bg-accent"
                aria-label="Fewer copies"
                onClick={() => setQty(c.units.length - 1)}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <Input
                aria-label="Copies"
                value={c.units.length}
                onChange={(e) => setQty(Math.floor(num(e.target.value)))}
                className="h-7 w-10 rounded-none border-0 border-x px-0 text-center font-mono"
              />
              <button
                className="grid h-7 w-7 place-items-center hover:bg-accent"
                aria-label="More copies"
                onClick={() => setQty(c.units.length + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </span>
        </div>

        {c.units.length > 1 && (
          <div role="tablist" aria-label="Copies" className="flex flex-wrap gap-1.5">
            {c.units.map((u, i) => (
              <button
                key={u.id}
                role="tab"
                aria-selected={i === idx}
                onClick={() => setUnitIdx(i)}
                className={cn(
                  "grid min-w-28 gap-1 rounded-lg border border-input bg-card px-2.5 py-1.5 text-left",
                  i === idx && "border-primary shadow-[inset_0_0_0_1px_var(--primary)]",
                )}
              >
                <span className="flex items-baseline gap-2 text-[12.5px] font-semibold">
                  {unitLabel(c, i)}
                  {c.maxHp !== null && (
                    <span className="ml-auto font-mono text-[11px] font-medium text-muted-foreground tabular">
                      {u.hp}/{c.maxHp}
                    </span>
                  )}
                </span>
                {c.maxHp !== null && (
                  <span className="h-1 overflow-hidden rounded-full bg-foreground/10">
                    <i
                      className={cn(
                        "block h-full",
                        u.hp / c.maxHp < 0.25
                          ? "bg-destructive"
                          : u.hp / c.maxHp < 0.5
                            ? "bg-gold"
                            : "bg-teal",
                      )}
                      style={{ width: `${(u.hp / c.maxHp) * 100}%` }}
                    />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {unit && c.units.length === 1 && c.maxHp !== null && <HpMeter hp={unit.hp} max={c.maxHp} />}
        {unit && (
          <ConditionChips
            name={unitLabel(c, idx)}
            conditions={unit.conditions ?? []}
            immune={immunities(c)}
            onChange={(next) => update((x) => setConditions(x, unit.id, () => next))}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1">
        {saved && (
          <Section id="character-uses" title="Slots and uses">
            <CharacterUses
              character={saved}
              onChange={(next) =>
                setCharacters((all) => all.map((person) => (person.id === next.id ? next : person)))
              }
            />
          </Section>
        )}
        <MonsterPanel key={c.id} c={c} update={update} />
        <Section
          id="currency"
          title="Currency"
          initial={false}
          count={total ? `${+total.toFixed(2)} gp` : undefined}
          className="mt-3"
        >
          <div className="grid grid-cols-4 gap-2">
            {(["cp", "sp", "gp", "pp"] as const).map((k) => (
              <label key={k} className="grid gap-1">
                <span className="label-caps">{k}</span>
                <Input
                  inputMode="numeric"
                  value={c.currency[k]}
                  onChange={(e) =>
                    update((x) => ({
                      ...x,
                      currency: { ...x.currency, [k]: num(e.target.value.replace(/[^0-9]/g, "")) },
                    }))
                  }
                  className="h-8 font-mono"
                />
              </label>
            ))}
          </div>
        </Section>
        <Section id="gear" title="Gear & loot" initial={false} count={c.loot.length || undefined}>
          <GearLoot c={c} update={update} />
        </Section>
        <Section id="notes" title="Notes & summary" initial={false}>
          <Textarea
            placeholder="Notes…"
            value={c.notes}
            onChange={(e) => update((x) => ({ ...x, notes: e.target.value }))}
            className="min-h-32"
          />
          <p className="mt-3 text-sm">
            Loot total: <span className="font-semibold">{+total.toFixed(2)} gp</span>
            {c.loot.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                + {c.loot.length} item{c.loot.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </Section>
      </div>
    </aside>
  );
}
