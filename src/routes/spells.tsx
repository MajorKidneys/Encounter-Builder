import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Star, Trash2 } from "lucide-react";
import { type Spell, levelLabel, useSpells } from "@/lib/spells";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/components/Workspace";

export const Route = createFileRoute("/spells")({
  validateSearch: (s: Record<string, unknown>): { spell?: string; list?: string } => ({
    ...(typeof s["spell"] === "string" ? { spell: s["spell"] } : {}),
    ...(typeof s["list"] === "string" ? { list: s["list"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Spell Book — Your Adventure" },
      { name: "description", content: "Search D&D 5e SRD spells and keep named spell lists for quick lookup in combat." },
      { property: "og:title", content: "Spell Book — Your Adventure" },
      { property: "og:description", content: "Search D&D 5e SRD spells and keep named spell lists for quick lookup in combat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpellsPage,
});

const CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];

function SpellsPage() {
  const spells = useSpells();
  const { spell: selId, list: listId } = Route.useSearch();
  const navigate = useNavigate({ from: "/spells" });
  const { lists, setLists } = useWorkspace();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [cls, setCls] = useState("");
  const list = lists.find((l) => l.id === listId) ?? null;

  const results = useMemo(() => (spells ?? []).filter((s) =>
    (!list || list.spellIds.includes(s.id)) &&
    (!q || s.name.toLowerCase().includes(q.toLowerCase())) &&
    (level === "" || s.level === Number(level)) &&
    (!cls || s.classes.includes(cls))), [spells, list, q, level, cls]);
  const sel = spells?.find((s) => s.id === selId) ?? null;
  const toggle = (lid: string, sid: string) => setLists((all) => all.map((l) => l.id !== lid ? l : { ...l, spellIds: l.spellIds.includes(sid) ? l.spellIds.filter((x) => x !== sid) : [...l.spellIds, sid] }));

  return (
    <div className="flex min-w-0 flex-1">
      <main className="flex w-72 shrink-0 flex-col border-r border-border lg:w-96">
        <div className="space-y-2 border-b border-border p-4">
          {list ? <div className="flex items-center gap-2">
            <Input aria-label="Favorite list name" value={list.name} onChange={(e) => setLists((all) => all.map((l) => l.id === list.id ? { ...l, name: e.target.value } : l))} className="min-w-0 font-display text-lg" />
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Delete list" onClick={() => {
              if (!confirm(`Delete list "${list.name}"?`)) return;
              setLists((all) => all.filter((l) => l.id !== list.id));
              void navigate({ search: (prev) => prev.spell ? { spell: prev.spell } : {} });
            }}><Trash2 /></Button>
          </div> : <h2 className="font-display text-2xl">Spell Book</h2>}
          <Input placeholder="Search spells…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-2">
            <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Any level</option>
              {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{levelLabel(i)}</option>)}
            </select>
            <select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Any class</option>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">{spells ? `${results.length} spells` : "Loading…"}{list && ` in ${list.name}`}</p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {results.map((s) => (
            <li key={s.id}>
              <Button asChild variant="ghost" className="h-auto w-full justify-between gap-2 whitespace-normal rounded-none border-b border-border px-4 py-2 text-left text-sm">
                <Link to="/spells" search={(prev) => ({ ...prev, spell: s.id })} activeOptions={{ includeSearch: true, exact: true }} activeProps={{ className: "bg-accent" }}>
                <span className="min-w-0 font-medium">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.level === 0 ? "Cantrip" : `Lvl ${s.level}`} · {s.school}</span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </main>

      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        {sel ? <Detail s={sel} lists={lists} toggle={toggle} /> : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><BookOpen className="h-8 w-8" /> Pick a spell to read it.</div>
        )}
        <p className="mt-8 text-xs text-muted-foreground">Spells from the System Reference Document 5.1 by Wizards of the Coast, licensed under CC-BY 4.0.</p>
      </section>
    </div>
  );
}

function Detail({ s, lists, toggle }: { s: Spell; lists: { id: string; name: string; spellIds: string[] }[]; toggle: (l: string, s: string) => void }) {
  const row = (k: string, v?: string) => v ? <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt><dd>{v}</dd></div> : null;
  return (
    <article className="max-w-2xl">
      <h2 className="font-display text-3xl">{s.name}</h2>
      <p className="italic text-muted-foreground">{s.level === 0 ? `${s.school} cantrip` : `${levelLabel(s.level)} ${s.school.toLowerCase()}`}{s.ritual && " (ritual)"}</p>
      <dl className="my-4 grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-3">
        {row("Casting time", s.time)}{row("Range", s.range)}{row("Area", s.area)}
        {row("Duration", s.duration + (s.conc ? " (concentration)" : ""))}
        {row("Components", s.components + (s.material ? ` (${s.material})` : ""))}
        {row("Save", s.save)}{row("Attack", s.attack && `${s.attack} spell attack`)}{row("Damage", s.damage)}{row("Healing", s.heal)}
        {row("Classes", s.classes.join(", "))}
      </dl>
      <div className="space-y-3 whitespace-pre-line leading-relaxed">{s.desc}</div>
      {s.higher && <p className="mt-3 whitespace-pre-line"><span className="font-semibold italic">At higher levels. </span>{s.higher}</p>}
      <div className="mt-6">
        <h3 className="mb-2 flex items-center gap-1 font-semibold"><Star className="h-4 w-4" /> Save to lists</h3>
        <div className="flex flex-wrap gap-4">
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={l.spellIds.includes(s.id)} onCheckedChange={() => toggle(l.id, s.id)} /> {l.name}
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}
