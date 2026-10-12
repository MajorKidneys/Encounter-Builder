import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Download,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  type Combatant,
  type Encounter,
  lootTotalGp,
  makeUnits,
  uid,
} from "@/lib/encounters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MonsterPanel } from "@/components/MonsterPanel";
import { GearLoot } from '@/components/GearLoot';
import { MonsterImportDialog } from '@/components/MonsterImportDialog';
import { useWorkspace } from '@/components/Workspace';
import { combatantFromLibrary } from '@/lib/equipment';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Adventure — Encounter Tracker" },
      { name: "description", content: "DM initiative, hit point and loot tracker for D&D 5e encounters." },
      { property: "og:title", content: "Your Adventure — Encounter Tracker" },
      { property: "og:description", content: "DM initiative, hit point and loot tracker for D&D 5e encounters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const num = (v: string) => (v === "" || isNaN(Number(v)) ? 0 : Number(v));

function Index() {
  const { encounters, setEncounters, activeId, setActiveId, newEncounter } = useWorkspace();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Close the loot drawer when clicking anywhere outside of it.
  useEffect(() => {
    if (!drawerId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Dialogs and popovers render in portals outside the drawer panel — clicks there
      // belong to the lightbox, never to the page behind it.
      if (t.closest("[role=dialog]") || t.closest("[data-radix-popper-content-wrapper]")) return;
      if (t.closest("[data-drawer-panel]") || t.closest("[data-drawer-trigger]")) return;
      setDrawerId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [drawerId]);

  const active = encounters.find((e) => e.id === activeId) ?? encounters[0] ?? null;
  const updateEnc = (id: string, fn: (e: Encounter) => Encounter) =>
    setEncounters((all) => all.map((e) => (e.id === id ? fn(e) : e)));
  const updateC = (cid: string, fn: (c: Combatant) => Combatant) =>
    active &&
    updateEnc(active.id, (e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === cid ? fn(c) : c)) }));

  const sorted = active ? [...active.combatants].sort((a, b) => b.init - a.init) : [];
  const drawer = active?.combatants.find((c) => c.id === drawerId) ?? null;

  return (
    <div className="flex min-w-0 flex-1">
      {/* Main */}
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <p>Start your first encounter.</p>
            <Button onClick={newEncounter}>
              <Plus className="h-4 w-4" /> New Encounter
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="font-display text-2xl">Encounter:</span>
              <Input
                aria-label="Encounter name"
                value={active.name}
                onChange={(ev) => updateEnc(active.id, (e) => ({ ...e, name: ev.target.value }))}
                className="h-10 min-w-0 max-w-sm font-display text-2xl md:text-2xl"
              />
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateEnc(active.id, (e) => ({ ...e, archived: !e.archived }))}
                >
                  {active.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {active.archived ? "Reopen" : "Resolve & archive"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete encounter"
                  onClick={() => {
                    if (!confirm(`Delete "${active.name}" permanently?`)) return;
                    setEncounters((all) => all.filter((e) => e.id !== active.id));
                    setActiveId(null);
                    setDrawerId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {active.archived && (
              <p className="mb-3 text-sm text-muted-foreground">This encounter is archived. You can still edit it.</p>
            )}
            <CombatTable
              rows={sorted}
              selectedId={drawerId}
              onSelect={(id) => setDrawerId(id)}
              updateC={updateC}
              removeC={(cid) => {
                updateEnc(active.id, (e) => ({ ...e, combatants: e.combatants.filter((c) => c.id !== cid) }));
                if (drawerId === cid) setDrawerId(null);
              }}
              addC={(c) => updateEnc(active.id, (e) => ({ ...e, combatants: [...e.combatants, c] }))}
              onImportMonster={() => setImportOpen(true)}
            />
          </>
        )}
      </main>

      {drawer && <LootDrawer c={drawer} onClose={() => setDrawerId(null)} update={(fn) => updateC(drawer.id, fn)} />}
      <MonsterImportDialog open={importOpen} onOpenChange={setImportOpen} title="Add a monster from the library" onImport={(m) => {
        if (!active) return;
        updateEnc(active.id, (e) => ({ ...e, combatants: [...e.combatants, combatantFromLibrary(m)] }));
        setImportOpen(false);
      }} />
    </div>
  );
}

const cell = "border border-border px-2 py-1.5 align-middle";

function CombatTable({
  rows,
  selectedId,
  onSelect,
  updateC,
  removeC,
  addC,
  onImportMonster,
}: {
  rows: Combatant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  updateC: (id: string, fn: (c: Combatant) => Combatant) => void;
  removeC: (id: string) => void;
  addC: (c: Combatant) => void;
  onImportMonster: () => void;
}) {
  const [draft, setDraft] = useState({ init: "", qty: "1", name: "", isPC: false, hp: "" });
  const submit = () => {
    if (!draft.name.trim()) return;
    const qty = Math.max(1, Math.floor(num(draft.qty)) || 1);
    const maxHp = draft.hp === "" ? null : num(draft.hp);
    addC({
      id: uid(),
      init: num(draft.init),
      qty,
      name: draft.name.trim(),
      isPC: draft.isPC,
      maxHp,
      units: makeUnits(qty, maxHp),
      loot: [],
      currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
      notes: "",
    });
    setDraft({ init: "", qty: "1", name: "", isPC: false, hp: "" });
  };

  return (
    <table className="w-full border-collapse overflow-hidden rounded-md bg-card text-sm">
      <thead className="bg-secondary">
        <tr className="text-left">
          {["Init", "Qty", "Name", "PC?", "HP", "Adjust", "Remove"].map((h) => (
            <th key={h} className={cn(cell, "py-2 font-semibold", h !== "Name" && "text-center")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const sel = c.id === selectedId;
          const rowSpan = c.units.length;
          return c.units.map((u, i) => (
            <tr key={u.id} className={cn(sel && "bg-accent")}>
              {i === 0 && (
                <>
                  <td rowSpan={rowSpan} className={cn(cell, "w-16 text-center")}>
                    <Input
                      type="number"
                      value={c.init}
                      onChange={(e) => updateC(c.id, (x) => ({ ...x, init: num(e.target.value) }))}
                      className="h-8 w-14 text-center"
                    />
                  </td>
                  <td rowSpan={rowSpan} className={cn(cell, "w-16 text-center")}>
                    <Input
                      type="number"
                      min={1}
                      value={c.qty}
                      onChange={(e) => {
                        const q = Math.max(1, Math.floor(num(e.target.value)) || 1);
                        updateC(c.id, (x) => ({
                          ...x,
                          qty: q,
                          units:
                            q > x.units.length
                              ? [...x.units, ...makeUnits(q - x.units.length, x.maxHp)]
                              : x.units.slice(0, q),
                        }));
                      }}
                      className="h-8 w-14 text-center"
                    />
                  </td>
                  <td
                    rowSpan={rowSpan}
                    data-drawer-trigger
                    className={cn(cell, "cursor-pointer font-medium hover:underline")}
                    onClick={() => onSelect(c.id)}
                    title="Open loot drawer"
                  >
                    {c.name}
                  </td>
                  <td rowSpan={rowSpan} className={cn(cell, "w-14 text-center")}>
                    <Checkbox
                      checked={c.isPC}
                      onCheckedChange={(v) => updateC(c.id, (x) => ({ ...x, isPC: !!v }))}
                    />
                  </td>
                </>
              )}
              <td className={cn(cell, "w-28 text-center tabular-nums", c.maxHp !== null && u.hp <= 0 && "text-destructive")}>
                {c.maxHp === null ? <span className="text-muted-foreground">—</span> : `${u.hp} / ${c.maxHp}`}
              </td>
              <td className={cn(cell, "w-44")}>
                {c.maxHp !== null && (
                  <Adjust
                    onApply={(d) =>
                      updateC(c.id, (x) => ({
                        ...x,
                        units: x.units.map((y) =>
                          y.id === u.id ? { ...y, hp: Math.min(x.maxHp ?? 0, Math.max(0, y.hp + d)) } : y,
                        ),
                      }))
                    }
                  />
                )}
              </td>
              <td className={cn(cell, "w-20 text-center")}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() =>
                    c.units.length <= 1
                      ? removeC(c.id)
                      : updateC(c.id, (x) => {
                          const units = x.units.filter((y) => y.id !== u.id);
                          return { ...x, units, qty: units.length };
                        })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ));
        })}
        <tr className="bg-muted/40">
          <td className={cell}>
            <Input type="number" placeholder="#" value={draft.init} onChange={(e) => setDraft({ ...draft, init: e.target.value })} className="h-8 w-14" />
          </td>
          <td className={cell}>
            <Input type="number" min={1} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} className="h-8 w-14" />
          </td>
          <td className={cell}>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Name (e.g. Goblin)"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="h-8 min-w-0 flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={onImportMonster}
                className="h-8 shrink-0 whitespace-nowrap"
              >
                <Download className="h-4 w-4" /> Import monster
              </Button>
            </div>
          </td>
          <td className={cn(cell, "text-center")}>
            <Checkbox checked={draft.isPC} onCheckedChange={(v) => setDraft({ ...draft, isPC: !!v })} />
          </td>
          <td className={cell}>
            <Input
              type="number"
              placeholder="Max HP"
              value={draft.hp}
              onChange={(e) => setDraft({ ...draft, hp: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-8 w-24"
            />
          </td>
          <td className={cell} colSpan={2}>
            <Button size="sm" onClick={submit} className="w-full">
              <Plus className="h-4 w-4" /> Add to initiative
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Adjust({ onApply }: { onApply: (delta: number) => void }) {
  const [v, setV] = useState("");
  const apply = (sign: 1 | -1) => {
    const n = Math.abs(num(v));
    if (n) onApply(sign * n);
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} className="h-8 w-16 text-center" />
      <div className="flex">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-r-none" aria-label="Damage" onClick={() => apply(-1)}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-l-none border-l-0" aria-label="Heal" onClick={() => apply(1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function LootDrawer({
  c,
  onClose,
  update,
}: {
  c: Combatant;
  onClose: () => void;
  update: (fn: (c: Combatant) => Combatant) => void;
}) {
  const total = lootTotalGp(c.currency);
  return (
    <aside data-drawer-panel className="flex w-[26rem] shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="truncate font-display text-2xl">{c.name}</h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <MonsterPanel key={c.id} c={c} update={update} />
        <section>
          <h3 className="mb-2 font-semibold">Currency</h3>
          <div className="space-y-2">
            {(["cp", "sp", "gp", "pp"] as const).map((k) => (
              <label key={k} className="flex items-center gap-4">
                <span className="w-8 text-sm">{k}:</span>
                <Input
                  inputMode="numeric"
                  value={c.currency[k]}
                  onChange={(e) =>
                    update((x) => ({ ...x, currency: { ...x.currency, [k]: num(e.target.value.replace(/[^0-9]/g, "")) } }))
                  }
                  className="h-8 w-24"
                />
              </label>
            ))}
          </div>
        </section>
        <GearLoot c={c} update={update} />
        <section>
          <h3 className="mb-2 font-semibold">Summary</h3>
          <Textarea
            placeholder="Notes..."
            value={c.notes}
            onChange={(e) => update((x) => ({ ...x, notes: e.target.value }))}
            className="min-h-32"
          />
          <p className="mt-3 text-sm">
            Loot total: <span className="font-semibold">{+total.toFixed(2)} gp</span>
            {c.loot.length > 0 && <span className="text-muted-foreground"> + {c.loot.length} item{c.loot.length > 1 ? "s" : ""}</span>}
          </p>
        </section>
      </div>
    </aside>
  );
}
