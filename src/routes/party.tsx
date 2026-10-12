import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  beginCharacterDrag,
  endCharacterDrag,
  identity,
  longRest,
  makeCharacter,
  shortRest,
  type CharacterRole,
} from "@/lib/characters";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/Workspace";
import { CharacterDrawer } from "@/components/party/CharacterDrawer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/party")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    ...(typeof s["id"] === "string" ? { id: s["id"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Party — Encounter Tracker" },
      {
        name: "description",
        content: "Saved player characters and NPCs for the current campaign.",
      },
    ],
  }),
  component: PartyPage,
});

function PartyPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/party" });
  const { characters, setCharacters } = useWorkspace();
  const pcs = characters.filter((c) => c.role === "pc");
  const npcs = characters.filter((c) => c.role === "npc");
  const selected = characters.find((c) => c.id === id) ?? null;
  const open = (next: string | null) => void navigate({ search: next ? { id: next } : {} });
  const add = (role: CharacterRole) => {
    const created = makeCharacter(role);
    setCharacters((all) => [...all, created]);
    open(created.id);
  };
  const update = (next: typeof selected) => {
    if (!next) return;
    setCharacters((all) => all.map((c) => (c.id === next.id ? next : c)));
  };

  return (
    <div className="flex min-w-0 flex-1">
      <main className="min-w-0 flex-1 overflow-auto px-7 pb-8 pt-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">Party</h1>
        <p className="mt-1 max-w-xl text-[12.5px] text-muted-foreground">
          Names and rest only. Slots and uses stay on the open character. A new sheet replaces that
          character when import arrives. Drag a name into an encounter.
        </p>
        <Roster
          title="Party"
          people={pcs}
          selectedId={selected?.id ?? null}
          empty="No player characters yet."
          onOpen={open}
          onAdd={() => add("pc")}
          addLabel="New character"
          onRest={(person, rest) => update(rest === "short" ? shortRest(person) : longRest(person))}
        />
        <Roster
          title="NPCs"
          people={npcs}
          selectedId={selected?.id ?? null}
          empty="No NPCs yet. They use race, class, and level, just like the party."
          onOpen={open}
          onAdd={() => add("npc")}
          addLabel="New NPC"
          onRest={(person, rest) => update(rest === "short" ? shortRest(person) : longRest(person))}
        />
      </main>
      {selected && (
        <CharacterDrawer
          character={selected}
          onChange={update}
          onClose={() => open(null)}
          onDelete={() => {
            setCharacters((all) => all.filter((c) => c.id !== selected.id));
            open(null);
          }}
        />
      )}
    </div>
  );
}

function Roster({
  title,
  people,
  selectedId,
  empty,
  onOpen,
  onAdd,
  addLabel,
  onRest,
}: {
  title: string;
  people: { id: string; name: string; race: string; classes: string }[];
  selectedId: string | null;
  empty: string;
  onOpen: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
  onRest: (
    person: { id: string; name: string; race: string; classes: string } & Parameters<
      typeof shortRest
    >[0],
    rest: "short" | "long",
  ) => void;
}) {
  const { characters } = useWorkspace();
  return (
    <section className="mt-6">
      <h2 className="label-caps mb-2">{title}</h2>
      {people.length === 0 && <p className="mb-2 text-sm text-muted-foreground">{empty}</p>}
      <ul className="grid gap-2">
        {people.map((person) => {
          const full = characters.find((c) => c.id === person.id)!;
          return (
            <li key={person.id}>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
                  selectedId === person.id && "border-primary",
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="min-w-0 flex-1 cursor-grab text-left"
                  draggable
                  onDragStart={(e) => {
                    beginCharacterDrag(person.id);
                    e.dataTransfer.setData("text/plain", person.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={endCharacterDrag}
                  onClick={() => onOpen(person.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(person.id);
                  }}
                >
                  <b className="block truncate">{person.name}</b>
                  <span className="text-[12.5px] text-muted-foreground">{identity(person)}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRest(full, "short")}
                  >
                    Short rest
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRest(full, "long")}
                  >
                    Long rest
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        className="mt-1 justify-start px-2 font-normal text-muted-foreground"
        onClick={onAdd}
      >
        <Plus /> {addLabel}
      </Button>
    </section>
  );
}
