import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, ChevronLeft, Plus, Square, Trash2 } from "lucide-react";
import { uid, type Combatant, type Encounter } from "@/lib/encounters";
import {
  addCharacterToEncounter,
  combatantFromCharacter,
  draggedCharacterId,
  endCharacterDrag,
} from "@/lib/characters";
import {
  endCombat,
  hasRolled,
  isLive,
  nextTurn,
  prevTurn,
  startCombat,
  turnOrder,
} from "@/lib/turns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/Workspace";
import { InitiativeList } from "@/components/encounter/InitiativeList";
import { AddCombatant } from "@/components/encounter/AddCombatant";
import { PrepNotes } from "@/components/encounter/PrepNotes";
import { CreatureDrawer } from "@/components/encounter/CreatureDrawer";
import { Stage } from "@/components/Stage";
import { RefTerm } from "@/components/reference/RefTerm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your Adventure — Encounter Tracker" },
      {
        name: "description",
        content: "DM initiative, hit point and loot tracker for D&D 5e encounters.",
      },
      { property: "og:title", content: "Your Adventure — Encounter Tracker" },
      {
        property: "og:description",
        content: "DM initiative, hit point and loot tracker for D&D 5e encounters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { encounters, setEncounters, activeId, setActiveId, newEncounter, ready, characters } =
    useWorkspace();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Close the drawer when clicking anywhere outside of it.
  useEffect(() => {
    if (!drawerId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Dialogs and popovers render in portals outside the drawer panel — clicks there
      // belong to the lightbox, never to the page behind it.
      if (t.closest("[role=dialog]") || t.closest("[data-radix-popper-content-wrapper]")) return;
      if (t.closest("[data-drawer-panel]") || t.closest("[data-drawer-trigger]")) return;
      if (t.closest("[data-reference-drawer]")) return;
      setDrawerId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [drawerId]);

  const active = encounters.find((e) => e.id === activeId) ?? encounters[0] ?? null;
  const update = (fn: (e: Encounter) => Encounter) =>
    active && setEncounters((all) => all.map((e) => (e.id === active.id ? fn(e) : e)));
  const updateC = (cid: string, fn: (c: Combatant) => Combatant) =>
    update((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === cid ? fn(c) : c)) }));
  const drawer = active?.combatants.find((c) => c.id === drawerId) ?? null;
  const live = active ? isLive(active) : false;

  // Esc closes this panel only after popovers and the reference drawer.
  useEffect(() => {
    if (!drawerId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[role=dialog][data-state=open], [data-reference-drawer]")) return;
      setDrawerId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerId]);

  // Space advances the turn when focus isn't in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !active || !isLive(active)) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      update(nextTurn);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const takeCharacter = (e: React.DragEvent) => {
    const id = draggedCharacterId() || e.dataTransfer.getData("text/plain");
    endCharacterDrag();
    const character = characters.find((c) => c.id === id);
    if (!character) return;
    if (!active) {
      const encounter: Encounter = {
        id: uid(),
        name: "Encounter 1",
        archived: false,
        createdAt: Date.now(),
        combatants: [combatantFromCharacter(character)],
      };
      setEncounters((all) => [...all, encounter]);
      setActiveId(encounter.id);
      return;
    }
    setEncounters((all) =>
      all.map((en) => (en.id === active.id ? addCharacterToEncounter(en, character) : en)),
    );
  };
  const allowCharacter = (e: React.DragEvent) => {
    if (!draggedCharacterId()) return;
    e.preventDefault();
    setDragOver(true);
  };

  if (!ready) return <main className="min-h-0 min-w-0 flex-1" />;

  if (!active) {
    return (
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-muted-foreground",
          dragOver && "bg-primary/5",
        )}
        onDragOver={allowCharacter}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeCharacter(e);
        }}
      >
        <p>Start your first encounter.</p>
        <Button onClick={newEncounter}>
          <Plus className="h-4 w-4" /> New encounter
        </Button>
      </main>
    );
  }

  const order = turnOrder(active.combatants);
  const current = active.combatants.find((c) => c.id === active.turnId);
  const waiting = active.combatants.filter((c) => !hasRolled(c)).length;
  const upNext = live
    ? turnOrder(nextTurn(active).combatants).find((c) => c.id === nextTurn(active).turnId)
    : undefined;
  const meta = live
    ? [
        `${active.combatants.length} combatants`,
        current && `${current.name}'s turn`,
        upNext && upNext.id !== current?.id && `${upNext.name} is up next`,
      ]
    : [
        "Not started",
        `${active.combatants.length} combatants`,
        waiting ? `${waiting} still need initiative` : order.length ? "everyone has rolled" : "",
      ];

  return (
    <Stage
      drawer={
        drawer && (
          <CreatureDrawer
            c={drawer}
            onClose={() => setDrawerId(null)}
            update={(fn) => updateC(drawer.id, fn)}
          />
        )
      }
    >
      <div
        className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", dragOver && "bg-primary/5")}
        onDragOver={allowCharacter}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeCharacter(e);
        }}
      >
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-7 pb-8 pt-6">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[16rem] flex-1">
              <input
                aria-label="Encounter name"
                value={active.name}
                onChange={(ev) => update((e) => ({ ...e, name: ev.target.value }))}
                className="-ml-1.5 w-full max-w-xl rounded-md border border-transparent bg-transparent px-1.5 font-display text-[28px] font-bold leading-tight tracking-tight outline-none hover:border-input focus:border-primary focus:bg-card"
              />
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {meta.filter(Boolean).join(" · ")}
              </p>
            </div>
            {live ? (
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous turn"
                  title="Previous turn"
                  onClick={() => update(prevTurn)}
                >
                  <ChevronLeft />
                </Button>
                <div className="grid justify-items-center px-3 leading-none">
                  <RefTerm id="combat-flow" className="label-caps text-[9.5px]">
                    Round
                  </RefTerm>
                  <b className="font-mono text-lg font-semibold tabular">{active.round}</b>
                </div>
                <Button onClick={() => update(nextTurn)}>
                  Next turn{" "}
                  <kbd className="rounded bg-white/20 px-1.5 font-mono text-[10.5px]">Space</kbd>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="End combat"
                  title="End combat (keeps HP, conditions and initiative)"
                  onClick={() => update(endCombat)}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => update(startCombat)}
                disabled={!active.combatants.some(hasRolled)}
                title={
                  active.combatants.some(hasRolled)
                    ? undefined
                    : "Give someone an initiative roll first"
                }
              >
                Start combat
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => update((e) => ({ ...e, archived: !e.archived }))}
            >
              {active.archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {active.archived ? "Reopen" : "Resolve & archive"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete encounter"
              title="Delete encounter"
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
          {active.archived && (
            <p className="mb-3 text-sm text-muted-foreground">
              This encounter is archived. You can still edit it.
            </p>
          )}
          <section aria-label="Setting" className="mb-4">
            <label htmlFor="encounter-setting" className="label-caps">
              Setting
            </label>
            <Textarea
              id="encounter-setting"
              aria-label="Setting"
              value={active.setting ?? ""}
              placeholder="Where this happens, and what the party sees when they arrive."
              onChange={(ev) => update((e) => ({ ...e, setting: ev.target.value }))}
              className="mt-1.5 min-h-28"
            />
          </section>
          <PrepNotes encounter={active} update={update} />
          <div className="grid gap-4">
            <InitiativeList
              encounter={active}
              update={update}
              selectedId={drawerId}
              onSelect={setDrawerId}
            />
            <AddCombatant
              onAdd={(c) => update((e) => ({ ...e, combatants: [...e.combatants, c] }))}
            />
          </div>
        </main>
      </div>
    </Stage>
  );
}
