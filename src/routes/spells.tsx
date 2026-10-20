import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, Check, Plus, Trash2, X } from "lucide-react";
import { type Spell, type SpellList, levelLabel, useSpells } from "@/lib/spells";
import { uid } from "@/lib/encounters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/Workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/spells")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { spell?: string; list?: string; addTo?: string } => ({
    ...(typeof s["spell"] === "string" ? { spell: s["spell"] } : {}),
    ...(typeof s["list"] === "string" ? { list: s["list"] } : {}),
    ...(typeof s["addTo"] === "string" ? { addTo: s["addTo"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Spell Book — Your Adventure" },
      {
        name: "description",
        content: "Search D&D 5e SRD spells and keep named spell lists for quick lookup in combat.",
      },
      { property: "og:title", content: "Spell Book — Your Adventure" },
      {
        property: "og:description",
        content: "Search D&D 5e SRD spells and keep named spell lists for quick lookup in combat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpellsPage,
});

const CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const short = (s: string) =>
  s
    .replace(/\bfeet\b/g, "ft")
    .replace(/^Up to /, "")
    .replace("Instantaneous", "Instant");

/** One line a DM can read mid-fight: the save or attack and what it does, else the opening sentence. */
export function effectLine(s: Spell): string {
  const parts = [
    s.save && `${s.save[0]}${s.save.slice(1).toLowerCase()} save`,
    s.attack && `${s.attack[0]!.toUpperCase()}${s.attack.slice(1)} spell attack`,
    s.damage,
    s.heal && `Heal ${s.heal}`,
    s.area,
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join(" · ").replace(/MOD/g, "mod");
  const first = s.desc.split(/(?<=\.)\s/)[0] ?? "";
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
}

function SpellsPage() {
  const spells = useSpells();
  const { spell: selId, list: listId, addTo } = Route.useSearch();
  const navigate = useNavigate({ from: "/spells" });
  const { lists, setLists } = useWorkspace();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [cls, setCls] = useState("");
  const list = lists.find((l) => l.id === listId) ?? null;
  const target = !list ? (lists.find((l) => l.id === addTo) ?? null) : null;

  const results = useMemo(
    () =>
      (spells ?? []).filter(
        (s) =>
          (!list || list.spellIds.includes(s.id)) &&
          (!q || s.name.toLowerCase().includes(q.toLowerCase())) &&
          (level === "" || s.level === Number(level)) &&
          (!cls || s.classes.includes(cls)),
      ),
    [spells, list, q, level, cls],
  );
  const sel = spells?.find((s) => s.id === selId) ?? null;
  const toggle = (lid: string, sid: string) =>
    setLists((all) =>
      all.map((l) =>
        l.id !== lid
          ? l
          : {
              ...l,
              spellIds: l.spellIds.includes(sid)
                ? l.spellIds.filter((x) => x !== sid)
                : [...l.spellIds, sid],
            },
      ),
    );
  const newList = (withSpell?: string) => {
    const id = uid();
    setLists((all) => [...all, { id, name: "New list", spellIds: withSpell ? [withSpell] : [] }]);
    return id;
  };
  const conc = list ? results.filter((s) => s.conc).length : 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <main className="flex min-h-0 w-80 shrink-0 flex-col border-r border-border lg:w-[23rem]">
        <div className="grid gap-2.5 border-b border-border p-4">
          {list ? (
            <>
              <p className="label-caps">Quick reference</p>
              <div className="-mt-1 flex items-center gap-2">
                <input
                  aria-label="List name"
                  value={list.name}
                  onChange={(e) =>
                    setLists((all) =>
                      all.map((l) => (l.id === list.id ? { ...l, name: e.target.value } : l)),
                    )
                  }
                  className="-ml-1 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 font-display text-2xl font-bold tracking-tight outline-none hover:border-input focus:border-primary focus:bg-card"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Delete list"
                  title="Delete list"
                  onClick={() => {
                    if (!confirm(`Delete list "${list.name}"?`)) return;
                    setLists((all) => all.filter((l) => l.id !== list.id));
                    void navigate({ search: (prev) => (prev.spell ? { spell: prev.spell } : {}) });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {list.spellIds.length} spells{conc ? ` · ${conc} need concentration` : ""}
              </p>
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() =>
                  void navigate({
                    search: (prev) => ({
                      ...(prev.spell ? { spell: prev.spell } : {}),
                      addTo: list.id,
                    }),
                  })
                }
              >
                <Plus /> Add spells
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight">Spell Book</h2>
              <Input
                placeholder="Search spells…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="flex gap-2">
                <select
                  aria-label="Level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                >
                  <option value="">Any level</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i}>
                      {levelLabel(i)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Class"
                  value={cls}
                  onChange={(e) => setCls(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                >
                  <option value="">Any class</option>
                  {CLASSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <label
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted-foreground",
                  target ? "bg-primary/15 font-medium text-wine-ink" : "bg-primary/[0.06]",
                )}
              >
                Quick add to
                <select
                  aria-label="Quick add to list"
                  value={target?.id ?? ""}
                  className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-1.5 text-foreground"
                  onChange={(e) =>
                    void navigate({
                      search: (prev) => ({
                        ...(prev.spell ? { spell: prev.spell } : {}),
                        ...(e.target.value ? { addTo: e.target.value } : {}),
                      }),
                    })
                  }
                >
                  <option value="">Off</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-mono text-[11px] text-muted-foreground">
                {spells ? `${results.length} spells · C = concentration` : "Loading…"}
              </p>
            </>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list ? (
            <QuickReference
              spells={results}
              selId={selId}
              onRemove={(sid) => toggle(list.id, sid)}
            />
          ) : (
            results.map((s) => (
              <BookRow
                key={s.id}
                s={s}
                active={s.id === selId}
                target={target}
                onToggle={() => target && toggle(target.id, s.id)}
              />
            ))
          )}
          {list && list.spellIds.length === 0 && (
            <li className="grid justify-items-start gap-3 p-4 text-sm text-muted-foreground">
              No spells on this list yet.
              <Button onClick={() => void navigate({ search: { addTo: list.id } })}>
                <Plus /> Add spells
              </Button>
            </li>
          )}
        </ul>
      </main>

      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-8 py-7">
        {sel ? (
          <Detail s={sel} lists={lists} toggle={toggle} onNewList={() => newList(sel.id)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <BookOpen className="h-8 w-8" /> Pick a spell to read it.
          </div>
        )}
        <p className="mt-8 text-xs text-muted-foreground">
          Spells from the System Reference Document 5.1 by Wizards of the Coast, licensed under
          CC-BY 4.0.
        </p>
      </section>
    </div>
  );
}

const ConcMark = () => (
  <span
    title="Concentration"
    className="grid h-[18px] w-[18px] place-items-center rounded-full bg-gold/25 font-mono text-[10px] font-semibold text-gold-foreground"
  >
    C
  </span>
);

function BookRow({
  s,
  active,
  target,
  onToggle,
}: {
  s: Spell;
  active: boolean;
  target: SpellList | null;
  onToggle: () => void;
}) {
  const inList = target?.spellIds.includes(s.id) ?? false;
  return (
    <li
      className={cn(
        "flex items-center gap-2 border-b border-border pr-3 hover:bg-primary/[0.06]",
        active && "bg-accent",
      )}
    >
      <Link
        to="/spells"
        search={(prev) => ({ ...prev, spell: s.id })}
        className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2 py-2.5 pl-4"
      >
        <span className="min-w-0 truncate font-semibold">{s.name}</span>
        <span className="row-span-2 flex items-center gap-1.5">
          {s.conc && <ConcMark />}
          <span className="grid h-[22px] min-w-[26px] place-items-center rounded bg-secondary px-1.5 font-mono text-[11px] font-semibold text-secondary-foreground">
            {s.level === 0 ? "C0" : s.level}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{s.school}</span>
      </Link>
      {target && (
        <button
          onClick={onToggle}
          aria-pressed={inList}
          aria-label={`${inList ? "Remove from" : "Add to"} ${target.name}`}
          title={`${inList ? "Remove from" : "Add to"} ${target.name}`}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-md border",
            inList
              ? "border-primary bg-primary text-primary-foreground"
              : "border-dashed border-input bg-card text-muted-foreground hover:border-primary hover:text-wine-ink",
          )}
        >
          {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      )}
    </li>
  );
}

function QuickReference({
  spells,
  selId,
  onRemove,
}: {
  spells: Spell[];
  selId: string | undefined;
  onRemove: (id: string) => void;
}) {
  const sorted = [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return (
    <>
      {sorted.map((s, i) => (
        <li key={s.id}>
          {(i === 0 || sorted[i - 1]!.level !== s.level) && (
            <div className="label-caps sticky top-0 z-[1] border-b border-border bg-sidebar px-4 py-1.5">
              {levelLabel(s.level)}
            </div>
          )}
          <div
            className={cn(
              "group flex items-center border-b border-border hover:bg-primary/[0.06]",
              s.id === selId && "bg-accent",
            )}
          >
            <Link
              to="/spells"
              search={(prev) => ({ ...prev, spell: s.id })}
              className="grid min-w-0 flex-1 gap-0.5 py-2.5 pl-4"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {s.name}
                {s.conc && <ConcMark />}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {s.time} · {short(s.range)} · {s.conc ? "Conc. " : ""}
                {short(s.duration)}
              </span>
              <span className="text-[12.5px]">{effectLine(s)}</span>
            </Link>
            <button
              onClick={() => onRemove(s.id)}
              aria-label={`Remove ${s.name} from this list`}
              title="Remove from list"
              className="mr-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </>
  );
}

function Detail({
  s,
  lists,
  toggle,
  onNewList,
}: {
  s: Spell;
  lists: SpellList[];
  toggle: (l: string, s: string) => void;
  onNewList: () => void;
}) {
  const row = (k: string, v?: string | null, wide?: boolean) =>
    v ? (
      <div className={wide ? "col-span-full" : undefined}>
        <dt className="label-caps">{k}</dt>
        <dd className="mt-0.5">{v}</dd>
      </div>
    ) : null;
  return (
    <article className="grid max-w-2xl gap-4">
      <div>
        <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight">
          {s.name}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {s.level === 0
            ? `${s.school} cantrip`
            : `${levelLabel(s.level)} ${s.school.toLowerCase()}`}
          {s.ritual && " (ritual)"}
          {s.conc && " · concentration"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Spell lists">
        <span className="label-caps mr-1">On lists</span>
        {lists.map((l) => {
          const on = l.spellIds.includes(s.id);
          return (
            <button
              key={l.id}
              aria-pressed={on}
              onClick={() => toggle(l.id, s.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:border-primary hover:text-wine-ink",
              )}
            >
              {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {l.name}
            </button>
          );
        })}
        <button
          onClick={onNewList}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-input px-3 text-[12.5px] text-muted-foreground hover:border-primary hover:text-wine-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          New list
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        {row("Casting time", s.time)}
        {row("Range", s.range)}
        {row("Area", s.area)}
        {row(
          "Duration",
          s.conc ? `Concentration, ${s.duration.replace(/^Up to/, "up to")}` : s.duration,
        )}
        {row("Save", s.save)}
        {row("Attack", s.attack && `${s.attack} spell attack`)}
        {row("Damage", s.damage)}
        {row("Healing", s.heal)}
        {row("Components", s.components + (s.material ? ` (${s.material})` : ""), true)}
        {row("Classes", s.classes.join(", "), true)}
      </dl>
      <div className="max-w-[66ch] space-y-3 whitespace-pre-line text-[15px] leading-relaxed">
        {s.desc}
      </div>
      {s.higher && (
        <p className="max-w-[66ch] whitespace-pre-line text-[15px] leading-relaxed">
          <span className="font-semibold">At higher levels. </span>
          {s.higher}
        </p>
      )}
    </article>
  );
}
