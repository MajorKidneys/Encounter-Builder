import { useState } from "react";
import { ExternalLink, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { Spellcasting } from "@/lib/monsters";
import { type Spell, type SpellEntry, levelLabel, parseList, slotsFor, useSpells } from "@/lib/spells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const n = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));
const ord = (l: number) => `${l}${["st", "nd", "rd"][l - 1] ?? "th"}`;

export function SpellcastingBlock({ sp, onChange, onRemove }: { sp: Spellcasting; onChange: (p: Partial<Spellcasting>) => void; onRemove: () => void }) {
  const spells = useSpells();
  const [q, setQ] = useState("");
  const entries = sp.entries ?? parseList(sp.list, spells);
  const slots = sp.slots ?? Array(9).fill(0);
  const used = sp.used ?? Array(9).fill(0);
  const byId = (id?: string) => (id ? spells?.find((s) => s.id === id) : undefined);
  const setEntries = (e: SpellEntry[]) => onChange({ entries: e });
  const matches = q.trim() && spells ? spells.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const levels = [...new Set(entries.map((e) => e.level))].sort((a, b) => a - b);

  return (
    <div className="mb-2 space-y-2 rounded border border-border p-2">
      <div className="flex gap-1">
        <Input value={sp.name} onChange={(e) => onChange({ name: e.target.value })} className="h-8" />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove spellcasting" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1 text-xs">
        <label>Spell DC<Input type="number" value={sp.dc ?? ""} onChange={(e) => onChange({ dc: e.target.value === "" ? null : n(e.target.value) })} className="h-8" /></label>
        <label>To hit<Input type="number" value={sp.attack ?? ""} onChange={(e) => onChange({ attack: e.target.value === "" ? null : n(e.target.value) })} className="h-8" /></label>
        <label>Ability<Input value={sp.ability} onChange={(e) => onChange({ ability: e.target.value })} className="h-8" /></label>
        <label title="Sets slots from the full-caster table">Caster lvl
          <Input type="number" min={1} max={20} value={sp.casterLevel ?? ""} onChange={(e) => {
            const lv = e.target.value === "" ? undefined : Math.min(20, Math.max(1, n(e.target.value)));
            onChange(lv ? { casterLevel: lv, slots: slotsFor(lv), used: Array(9).fill(0) } : { casterLevel: undefined });
          }} className="h-8" />
        </label>
      </div>

      {slots.some((x) => x > 0) && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold">
            Spell slots (left / max)
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onChange({ used: Array(9).fill(0) })}>
              <RotateCcw className="h-3 w-3" /> Long rest
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {slots.map((max, i) => max > 0 && (
              <div key={i} className="flex items-center gap-0.5 rounded border border-border px-1 py-0.5 text-xs">
                <span className="w-6 font-semibold">{ord(i + 1)}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`Spend ${ord(i + 1)} slot`} onClick={() => onChange({ used: used.map((u, j) => (j === i ? Math.min(max, u + 1) : u)) })}><Minus className="h-3 w-3" /></Button>
                <span className="tabular-nums">{max - (used[i] ?? 0)}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`Regain ${ord(i + 1)} slot`} onClick={() => onChange({ used: used.map((u, j) => (j === i ? Math.max(0, u - 1) : u)) })}><Plus className="h-3 w-3" /></Button>
                <span>/</span>
                <input aria-label={`${ord(i + 1)} max`} type="number" min={0} value={max} onChange={(e) => onChange({ slots: slots.map((m, j) => (j === i ? Math.max(0, n(e.target.value)) : m)) })} className="w-7 bg-transparent text-center tabular-nums" />
              </div>
            ))}
          </div>
        </div>
      )}

      {levels.map((l) => (
        <div key={l}>
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{levelLabel(l)}</h5>
          <ul className="divide-y divide-border">
            {entries.map((e, i) => e.level === l && (
              <li key={i} className="flex items-start gap-1 py-1">
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-1">
                    {e.spellId ? (
                      <a href={`/spells?spell=${e.spellId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold hover:underline" title="Open full spell details">
                        {e.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="font-semibold">{e.name}</span>}
                    {e.note && <span className="text-muted-foreground">({e.note})</span>}
                  </div>
                  <QuickLine s={byId(e.spellId)} sp={sp} />
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Remove ${e.name}`} onClick={() => setEntries(entries.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="relative">
        <Input placeholder="Add a spell…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded border border-border bg-popover text-xs shadow-md">
            {matches.map((m) => (
              <li key={m.id}>
                <button className="flex w-full justify-between px-2 py-1 text-left hover:bg-accent" onClick={() => { setEntries([...entries, { name: m.name, level: m.level, spellId: m.id }]); setQ(""); }}>
                  {m.name} <span className="text-muted-foreground">{m.level === 0 ? "cantrip" : ord(m.level)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuickLine({ s, sp }: { s: Spell | undefined; sp: Spellcasting }) {
  if (!s) return null;
  const bits = [
    s.time, s.range, s.area, s.duration.replace(/^Up to /, "") + (s.conc ? " (conc.)" : ""),
    s.save ? `DC ${sp.dc ?? "?"} ${s.save} save` : s.attack ? `${sp.attack != null ? `+${sp.attack}` : "spell"} to hit (${s.attack})` : undefined,
    s.damage, s.heal && `heals ${s.heal}`,
  ].filter(Boolean);
  return <p className="text-muted-foreground">{bits.join(" · ")}</p>;
}
