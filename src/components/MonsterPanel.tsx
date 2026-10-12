import { useEffect, useState } from "react";
import { ChevronDown, Download, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { Combatant } from "@/lib/encounters";
import { uid } from "@/lib/encounters";
import {
  type Feature,
  type MonsterStats,
  type ResetOn,
  blankStats,
  crLabel,
  fromLibrary,
  loadLibrary,
  mod,
} from "@/lib/monsters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SpellcastingBlock } from "@/components/SpellcastingBlock";
import { installNativeGear, nativeArmorFor, syncGear } from '@/lib/equipment';
import { DescriptionSection } from '@/components/DescriptionSection';
import { MonsterImportDialog } from '@/components/MonsterImportDialog';

const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const RESETS: ResetOn[] = ["turn", "round", "short", "long"];
const RESET_LABEL: Record<ResetOn, string> = { turn: "Turn", round: "Round", short: "Short rest", long: "Long rest" };
const n = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));

export function MonsterPanel({ c, update }: { c: Combatant; update: (fn: (c: Combatant) => Combatant) => void }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [libraryDescription, setLibraryDescription] = useState("");
  const s = c.stats ?? { ...blankStats(c.name), hp: c.maxHp ?? 10 };
  useEffect(() => {
    let cancelled = false;
    setLibraryDescription("");
    if (s.srdId) loadLibrary().then((library) => {
      if (!cancelled) setLibraryDescription(library.find((m) => m.id === s.srdId)?.description ?? "");
    });
    return () => { cancelled = true; };
  }, [s.srdId]);

  const applyStats = (st: MonsterStats) =>
    update((x) => installNativeGear({ ...x, maxHp: st.hp, units: x.units.map((u) => ({ ...u, hp: st.hp })) }, st, nativeArmorFor(st.srdId)));
  useEffect(() => {
    if (c.stats?.srdId && !c.gearVersion) update(x => x.stats ? installNativeGear(x, x.stats, nativeArmorFor(x.stats.srdId)) : x);
  }, [c.id, c.gearVersion, c.stats?.srdId]);
  const set = (patch: Partial<MonsterStats>) =>
    update((x) => {
      const stats = { ...(x.stats ?? { ...blankStats(x.name), hp: x.maxHp ?? 10 }), ...patch };
      if (patch.hp === undefined) return syncGear({ ...x, stats });
      return syncGear({ ...x, stats, maxHp: stats.hp, units: x.units.map((u) => ({ ...u, hp: x.maxHp === null ? stats.hp : Math.min(u.hp, stats.hp) })) });
    });

  const resetSrd = async () => {
    if (!s?.srdId || !confirm("Restore the original SRD stats? Your edits will be lost.")) return;
    const m = (await loadLibrary()).find((x) => x.id === s.srdId);
    if (m) applyStats(fromLibrary(m));
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-0 font-semibold" aria-label={expanded ? "Collapse stats" : "Expand stats"} title={expanded ? "Collapse stats" : "Expand stats"}>
              <ChevronDown className={cn("h-4 w-4", !expanded && "-rotate-90")} /> Stats
            </Button>
          </CollapsibleTrigger>
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Download className="h-4 w-4" /> Import stats
        </Button>
        {s?.srdId && (
          <Button size="sm" variant="ghost" onClick={resetSrd}>
            <RotateCcw className="h-4 w-4" /> Reset to SRD
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <StatForm s={s} set={set} />
      </CollapsibleContent>
      <DescriptionSection key={c.id} description={s.description ?? libraryDescription} onChange={(description) => set({ description })} />
      <p className="text-xs text-muted-foreground">
        Monster data from the System Reference Document 5.1 by Wizards of the Coast LLC (CC-BY-4.0) and the
        Monstrous Menagerie by EN Publishing (OGL 1.0a, via Open5e).
      </p>
      <MonsterImportDialog open={open} onOpenChange={setOpen} onImport={(m) => {
        if ((c.stats || c.maxHp !== null) && !confirm("Replace this creature's existing stats and native gear? Your stat edits will be lost and HP will reset to full.")) return;
        applyStats(fromLibrary(m)); setOpen(false); setExpanded(true);
      }} />
    </Collapsible>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-0.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatForm({ s, set }: { s: MonsterStats; set: (p: Partial<MonsterStats>) => void }) {
  const txt = (k: keyof MonsterStats, label: string) => (
    <Field label={label}>
      <Input value={s[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<MonsterStats>)} className="h-8" />
    </Field>
  );
  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-3">
      <div>
        <p className="font-display text-lg">{s.name}</p>
        {!s.srd && (s.source
          ? <p className="text-xs font-semibold text-muted-foreground">From {s.source} (EN Publishing, OGL 1.0a)</p>
          : <p className="text-xs font-semibold text-destructive">Custom — not from SRD 5.1</p>)}
      </div>
      {txt("meta", "Type")}
      <div className="grid grid-cols-3 gap-2">
        <Field label="AC">
          <Input type="number" value={s.ac} onChange={(e) => set({ ac: n(e.target.value) })} className="h-8" />
        </Field>
        <Field label="Max HP (avg)">
          <Input type="number" value={s.hp} onChange={(e) => set({ hp: Math.max(0, n(e.target.value)) })} className="h-8" />
        </Field>
        <Field label="Hit dice">
          <Input value={s.hitDice} placeholder="5d8+5" onChange={(e) => set({ hitDice: e.target.value })} className="h-8" />
        </Field>
      </div>
      {txt("acNote", "Armor note")}
      {txt("speed", "Speed")}
      <div className="grid grid-cols-6 gap-1 text-center">
        {ABS.map((a, i) => (
          <div key={a}>
            <div className="text-xs font-semibold">{a}</div>
            <Input
              type="number"
              value={s.abilities[i]}
              onChange={(e) => set({ abilities: s.abilities.map((v, j) => (j === i ? n(e.target.value) : v)) })}
              className="h-8 px-1 text-center"
            />
            <div className="text-xs text-muted-foreground">{mod(s.abilities[i])}</div>
          </div>
        ))}
      </div>
      {txt("saves", "Saving throws")}
      {txt("skills", "Skills")}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Passive Perception">
          <Input type="number" value={s.passive} onChange={(e) => set({ passive: n(e.target.value) })} className="h-8" />
        </Field>
        <Field label="Challenge rating">
          <Input value={crLabel(s.cr)} onChange={(e) => {
            const v = e.target.value; const [a = "", b] = v.split("/");
            set({ cr: b ? n(a) / (n(b) || 1) : n(v) });
          }} className="h-8" />
        </Field>
      </div>
      {txt("senses", "Senses")}
      {txt("languages", "Languages")}
      {txt("vuln", "Damage vulnerabilities")}
      {txt("resist", "Damage resistances")}
      {txt("immune", "Damage immunities")}
      {txt("condImmune", "Condition immunities")}
      <Resources s={s} set={set} />
      <FeatureList title="Special abilities" items={s.special} onChange={(special) => set({ special })} />
      <FeatureList title="Actions" items={s.actions} onChange={(actions) => set({ actions })} />
      <FeatureList title="Reactions" items={s.reactions} onChange={(reactions) => set({ reactions })} />
      <FeatureList title="Legendary actions" items={s.legendary} onChange={(legendary) => set({ legendary })} />
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Spellcasting</h4>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => set({ spells: [...s.spells, { name: "Spellcasting", dc: null, attack: null, ability: "", list: "" }] })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {s.spells.map((sp, i) => (
          <SpellcastingBlock key={i} sp={sp} onChange={(p) => set({ spells: s.spells.map((x, j) => (j === i ? { ...x, ...p } : x)) })} onRemove={() => set({ spells: s.spells.filter((_, j) => j !== i) })} />
        ))}
      </div>
    </div>
  );
}

function FeatureList({ title, items, onChange }: { title: string; items: Feature[]; onChange: (f: Feature[]) => void }) {
  const up = (i: number, p: Partial<Feature>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button size="sm" variant="ghost" className="h-7" aria-label={`Add ${title}`} onClick={() => onChange([...items, { name: "", desc: "" }])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.map((f, i) => (
        <div key={i} className="mb-2 space-y-1 rounded border border-border p-2">
          <div className="flex gap-1">
            <Input value={f.name} placeholder="Name" onChange={(e) => up(i, { name: e.target.value })} className="h-8 font-medium" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Field label="To hit">
              <Input type="number" value={f.attack ?? ""} onChange={(e) => up(i, { attack: e.target.value === "" ? undefined : n(e.target.value) })} className="h-8" />
            </Field>
            <Field label="Damage" className="col-span-2">
              <Input value={f.damage ?? ""} placeholder="2d6+5 slashing" onChange={(e) => up(i, { damage: e.target.value || undefined })} className="h-8" />
            </Field>
          </div>
          <Textarea value={f.desc} onChange={(e) => up(i, { desc: e.target.value })} className="min-h-16 text-xs" />
        </div>
      ))}
    </div>
  );
}

function Resources({ s, set }: { s: MonsterStats; set: (p: Partial<MonsterStats>) => void }) {
  const rs = s.resources;
  const up = (id: string, p: Partial<(typeof rs)[number]>) => set({ resources: rs.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const resetAll = (t: ResetOn) => {
    const covered = RESETS.slice(0, RESETS.indexOf(t) + 1);
    set({ resources: rs.map((r) => (covered.includes(r.reset) ? { ...r, current: r.max } : r)) });
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Resources</h4>
        <Button size="sm" variant="ghost" className="h-7" aria-label="Add resource" onClick={() => set({ resources: [...rs, { id: uid(), name: "", max: 1, current: 1, reset: "long" }] })}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {rs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {RESETS.map((t) => (
            <Button key={t} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => resetAll(t)}>
              New {RESET_LABEL[t].toLowerCase()}
            </Button>
          ))}
        </div>
      )}
      {rs.map((r) => (
        <div key={r.id} className="mb-2 space-y-1 rounded border border-border p-2">
          <div className="flex gap-1">
            <Input value={r.name} placeholder="Name" onChange={(e) => up(r.id, { name: e.target.value })} className="h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove" onClick={() => set({ resources: rs.filter((x) => x.id !== r.id) })}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Use" onClick={() => up(r.id, { current: Math.max(0, r.current - 1) })}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className={cn("w-12 text-center tabular-nums", r.current === 0 && "text-destructive")}>{r.current} / {r.max}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Restore" onClick={() => up(r.id, { current: Math.min(r.max, r.current + 1) })}>
              <Plus className="h-4 w-4" />
            </Button>
            <Input type="number" min={0} aria-label="Max" value={r.max} onChange={(e) => { const m = Math.max(0, n(e.target.value)); up(r.id, { max: m, current: Math.min(r.current, m) }); }} className="h-8 w-14" />
            <select value={r.reset} onChange={(e) => up(r.id, { reset: e.target.value as ResetOn })} className="h-8 flex-1 rounded-md border border-input bg-background px-1 text-xs">
              {RESETS.map((t) => <option key={t} value={t}>{RESET_LABEL[t]}</option>)}
            </select>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Reset" onClick={() => up(r.id, { current: r.max })}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
