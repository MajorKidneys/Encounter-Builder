import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { type Feature, type LibraryMonster, crLabel, loadLibrary, mod } from "@/lib/monsters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DescriptionSection } from "@/components/DescriptionSection";

const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

// Shared by the creature panel ("Import stats") and the encounter table ("Import monster").
export function MonsterImportDialog({ open, onOpenChange, onImport, title = "Import stats from the monster library" }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (m: LibraryMonster) => void;
  title?: string;
}) {
  const [lib, setLib] = useState<LibraryMonster[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<LibraryMonster | null>(null);
  useEffect(() => { if (open) loadLibrary().then(setLib); }, [open]);
  const list = useMemo(() => lib.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())), [lib, q]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid h-[60vh] grid-cols-[14rem_1fr] gap-4">
          <div className="flex flex-col gap-2 overflow-hidden">
            <Input autoFocus placeholder="Search monsters…" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {list.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setPick(m)} className={cn("w-full rounded px-2 py-1 text-left text-sm hover:bg-accent", pick?.id === m.id && "bg-accent font-medium")}>
                    {m.name} <span className="text-xs text-muted-foreground">CR {crLabel(m.cr)}</span>
                    {m.source && <span className="ml-1 rounded bg-muted px-1 text-xs text-muted-foreground">Menagerie</span>}
                    {!m.srd && !m.source && <span className="ml-1 text-xs text-destructive">not SRD</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-y-auto rounded-md border border-border p-4">
            {pick ? <Preview m={pick} onImport={() => onImport(pick)} /> : <p className="text-sm text-muted-foreground">Pick a monster to preview its stat block.</p>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Sources: SRD 5.1 by Wizards of the Coast LLC (CC-BY-4.0) and Monstrous Menagerie by EN Publishing (OGL 1.0a, via Open5e). {lib.length} entries total.</p>
      </DialogContent>
    </Dialog>
  );
}

function Preview({ m, onImport }: { m: LibraryMonster; onImport: () => void }) {
  const line = (k: string, v: string | number) => (v === "" ? null : <p><span className="font-semibold">{k}</span> {v}</p>);
  const feats = (t: string, f: Feature[]) => f.length > 0 && (
    <div className="mt-3">
      <h4 className="border-b border-border font-display text-base">{t}</h4>
      {f.map((x, i) => <p key={i} className="mt-1"><span className="font-semibold italic">{x.name}.</span> {x.desc}</p>)}
    </div>
  );
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl">{m.name}</h3>
          <p className="italic text-muted-foreground">{m.meta}</p>
        </div>
        <Button onClick={onImport}><Download className="h-4 w-4" /> Import</Button>
      </div>
      {line("Armor Class", `${m.ac}${m.acNote ? ` (${m.acNote})` : ""}`)}
      {line("Hit Points", `${m.hp} (${m.hitDice})`)}
      {line("Speed", m.speed)}
      <div className="my-2 grid grid-cols-6 text-center">
        {ABS.map((a, i) => <div key={a}><div className="font-semibold">{a}</div>{m.abilities[i]} ({mod(m.abilities[i])})</div>)}
      </div>
      {line("Saving Throws", m.saves)}
      {line("Skills", m.skills)}
      {line("Damage Vulnerabilities", m.vuln)}
      {line("Damage Resistances", m.resist)}
      {line("Damage Immunities", m.immune)}
      {line("Condition Immunities", m.condImmune)}
      {line("Senses", `${m.senses ? m.senses + ", " : ""}passive Perception ${m.passive}`)}
      {line("Languages", m.languages || "—")}
      {line("Challenge", crLabel(m.cr))}
      {feats("Special Abilities", m.special)}
      {m.spells.map((s, i) => <p key={i} className="mt-1"><span className="font-semibold italic">{s.name}.</span> {s.ability} — spell save DC {s.dc}, +{s.attack} to hit. {s.list}</p>)}
      {feats("Actions", m.actions)}
      {feats("Reactions", m.reactions)}
      {feats("Legendary Actions", m.legendary)}
      <DescriptionSection key={m.id} description={m.description ?? ""} />
    </div>
  );
}
