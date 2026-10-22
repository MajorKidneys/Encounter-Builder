import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  categoryLabel,
  entriesByCategory,
  FIRST_ENTRY_ID,
  getEntry,
  searchEntries,
  type RefCategory,
  type RefEntry,
} from "@/lib/reference";
import {
  readReferencePrefs,
  writeReferencePrefs,
  type ReferencePrefs,
} from "@/lib/reference-prefs";
import { cn } from "@/lib/utils";

type ReferenceContextValue = {
  tooltips: boolean;
  setTooltips: (on: boolean) => void;
  open: boolean;
  toggle: () => void;
  openEntry: (id: string) => void;
};

const ReferenceContext = createContext<ReferenceContextValue | null>(null);

export function useReference() {
  const value = useContext(ReferenceContext);
  if (!value) throw new Error("Reference provider is required");
  return value;
}

function clampHeight(px: number) {
  const max = Math.round(window.innerHeight * 0.8);
  const min = Math.min(320, max);
  return Math.min(max, Math.max(min, Math.round(px)));
}

function defaultHeight() {
  return clampHeight(window.innerHeight * 0.35);
}

function remember(prefs: ReferencePrefs) {
  writeReferencePrefs(prefs);
}

export function ReferenceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ReferencePrefs>({
    tooltips: true,
    height: null,
    lastId: null,
  });
  const [open, setOpen] = useState(false);
  const [entryId, setEntryId] = useState(FIRST_ENTRY_ID);
  const [tab, setTab] = useState<RefCategory>("start");
  const [query, setQuery] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readReferencePrefs();
    setPrefs(saved);
    const last = saved.lastId ? getEntry(saved.lastId) : undefined;
    const initial = last ?? getEntry(FIRST_ENTRY_ID);
    if (initial) {
      setEntryId(initial.id);
      setTab(initial.category);
    }
    setHeight(saved.height);
    setReady(true);
  }, []);

  const updatePrefs = useCallback((next: ReferencePrefs) => {
    setPrefs(next);
    remember(next);
  }, []);

  const showEntry = useCallback(
    (id: string, options?: { clearSearch?: boolean }) => {
      const entry = getEntry(id);
      if (!entry) return;
      setEntryId(entry.id);
      setTab(entry.category);
      if (options?.clearSearch) setQuery("");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1200);
      const next = { ...readReferencePrefs(), lastId: entry.id };
      setPrefs((current) => ({ ...current, lastId: entry.id }));
      remember({ ...next, tooltips: prefs.tooltips, height: height });
    },
    [height, prefs.tooltips],
  );

  const openEntry = useCallback(
    (id: string) => {
      showEntry(id, { clearSearch: true });
      setOpen(true);
    },
    [showEntry],
  );

  const toggle = useCallback(() => setOpen((current) => !current), []);

  const setTooltips = useCallback(
    (on: boolean) =>
      updatePrefs({ ...readReferencePrefs(), tooltips: on, height, lastId: entryId }),
    [entryId, height, updatePrefs],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
        return;
      }
      if (event.key !== "Escape" || !open) return;
      // Popovers (settings, the condition picker) are dialogs and close themselves.
      // Rules hover cards are not, so Escape still closes the drawer.
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, toggle]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-reference-drawer]")) return;
      if (target.closest("[data-reference-trigger]")) return;
      if (target.closest("[data-ref-term]")) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const value: ReferenceContextValue = {
    tooltips: prefs.tooltips,
    setTooltips,
    open,
    toggle,
    openEntry,
  };

  return (
    <ReferenceContext.Provider value={value}>
      {children}
      {ready && open && (
        <ReferenceDrawer
          entryId={entryId}
          tab={tab}
          query={query}
          flash={flash}
          height={height === null ? defaultHeight() : clampHeight(height)}
          onQuery={setQuery}
          onTab={(next) => {
            setQuery("");
            const first = entriesByCategory(next)[0];
            if (first) showEntry(first.id, { clearSearch: true });
            else setTab(next);
          }}
          onSelect={(id) => showEntry(id)}
          onRelated={(id) => showEntry(id, { clearSearch: true })}
          onHeight={(px) => {
            const next = clampHeight(px);
            setHeight(next);
            remember({ tooltips: prefs.tooltips, height: next, lastId: entryId });
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </ReferenceContext.Provider>
  );
}

function ReferenceMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^\s*-\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => /^\d+\.\s/.test(line.trim()))) {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return <p key={index}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

function ReferenceDrawer({
  entryId,
  tab,
  query,
  flash,
  height,
  onQuery,
  onTab,
  onSelect,
  onRelated,
  onHeight,
  onClose,
}: {
  entryId: string;
  tab: RefCategory;
  query: string;
  flash: boolean;
  height: number;
  onQuery: (query: string) => void;
  onTab: (tab: RefCategory) => void;
  onSelect: (id: string) => void;
  onRelated: (id: string) => void;
  onHeight: (px: number) => void;
  onClose: () => void;
}) {
  const entry = getEntry(entryId);
  const searching = query.trim().length > 0;
  const results = searching ? searchEntries(query) : entriesByCategory(tab);

  useEffect(() => {
    document
      .querySelector(`[data-entry-id="${CSS.escape(entryId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [entryId, tab, query]);

  const drag = (event: React.PointerEvent) => {
    event.preventDefault();
    const move = (pointer: PointerEvent) => onHeight(window.innerHeight - pointer.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section
      data-reference-drawer
      aria-label="Reference"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-border bg-background shadow-[0_-18px_40px_-28px_rgba(0,0,0,.45)]"
      style={{ height }}
    >
      <button
        type="button"
        aria-label="Resize reference"
        className="mx-auto mt-2 h-1.5 w-16 shrink-0 cursor-ns-resize rounded-full bg-foreground/15"
        onPointerDown={drag}
      />
      <div className="flex items-center gap-2 px-4 pb-2 pt-2">
        <input
          aria-label="Search the reference"
          placeholder="Search the reference"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
        />
        <Button variant="ghost" size="icon" aria-label="Close reference" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto px-4 pb-2">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={tab === category.id}
            onClick={() => onTab(category.id)}
            className={cn(
              "h-7 shrink-0 rounded-full px-3 text-xs font-medium",
              tab === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:text-wine-ink",
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] border-t border-border">
        <ul className="overflow-y-auto border-r border-border py-1">
          {searching && (
            <li className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {results.length} {results.length === 1 ? "result" : "results"}
            </li>
          )}
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No matches.</li>
          )}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-entry-id={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
                  item.id === entryId && "bg-accent font-semibold text-wine-ink",
                )}
              >
                <span className="block truncate">{item.term}</span>
                {searching && (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {categoryLabel(item.category)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="overflow-y-auto px-5 py-4">
          {entry ? <EntryBody entry={entry} flash={flash} onRelated={onRelated} /> : null}
        </div>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Includes material from the System Reference Document 5.1 by Wizards of the Coast LLC,
        licensed under CC-BY-4.0.
      </p>
    </section>
  );
}

function EntryBody({
  entry,
  flash,
  onRelated,
}: {
  entry: RefEntry;
  flash: boolean;
  onRelated: (id: string) => void;
}) {
  const source =
    entry.source === "SRD 5.1"
      ? "System Reference Document 5.1 (CC-BY-4.0)"
      : "Written for this app";
  return (
    <article
      className={cn(
        "rounded-lg border-l-[3px] px-3 py-1 transition-colors duration-700",
        flash ? "border-primary bg-accent" : "border-transparent",
      )}
    >
      <h2 className="font-display text-2xl font-bold tracking-tight">{entry.term}</h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {entry.edition} · {entry.source}
        </span>
        {entry.changedIn2024 && (
          <span className="rounded bg-gold/25 px-1.5 py-0.5 font-semibold text-gold-foreground">
            Changed in 2024
          </span>
        )}
      </p>
      <div className="mt-3">
        <ReferenceMarkdown text={entry.body} />
      </div>
      {entry.table && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {entry.table.columns.map((column) => (
                  <th
                    key={column}
                    className="label-caps whitespace-nowrap border-b border-border px-2 py-1.5"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.table.rows.map((row) => (
                <tr key={row.join("|")} className="border-b border-border/70">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className="whitespace-nowrap px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entry.changedIn2024 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">2024 rules. </span>
          {entry.changedIn2024}
        </p>
      )}
      {entry.related && entry.related.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="label-caps mr-1">Related</span>
          {entry.related.map((id) => {
            const related = getEntry(id);
            if (!related) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onRelated(id)}
                className="h-7 rounded-full border border-input bg-card px-3 text-xs hover:border-primary hover:text-wine-ink"
              >
                {related.term}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">Source: {source}</p>
    </article>
  );
}
