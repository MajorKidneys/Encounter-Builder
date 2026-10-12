import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BookOpen,
  Bookmark,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import { uid, type Encounter } from "@/lib/encounters";
import { identity, makeCharacter, type CharacterRole } from "@/lib/characters";
import { DEFAULT_CAMPAIGN_NAME, useCampaignStore } from "@/lib/campaigns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

type WorkspaceState = ReturnType<typeof useCampaignStore> & {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  newEncounter: () => void;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace provider is required");
  return value;
}

export function Workspace({ children }: { children: ReactNode }) {
  const campaigns = useCampaignStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [renameArmed, setRenameArmed] = useState(false);
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const isSpells = location.pathname === "/spells";
  const isParty = location.pathname === "/party";
  const selectedList = (location.search as { list?: string }).list;
  const selectedCharacter = (location.search as { id?: string }).id;
  const active = campaigns.encounters.find((e) => e.id === activeId) ?? campaigns.encounters[0];

  useEffect(() => {
    if (!renameArmed || !campaigns.ready) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    setRenameArmed(false);
  }, [renameArmed, campaigns.ready, campaigns.campaignId]);

  const leaveScopedPage = () => {
    if (isSpells) void navigate({ to: "/spells", search: {} });
    if (isParty) void navigate({ to: "/party", search: {} });
  };
  const chooseCampaign = (id: string) => {
    if (id === campaigns.campaignId) return;
    campaigns.selectCampaign(id);
    setActiveId(null);
    leaveScopedPage();
  };
  const createCampaign = () => {
    const created = campaigns.createCampaign();
    setActiveId(null);
    setRenameArmed(true);
    if (isSpells && created?.listId)
      void navigate({ to: "/spells", search: { list: created.listId } });
  };
  const deleteCampaign = () => {
    const current = campaigns.campaign;
    if (!current || campaigns.campaigns.length < 2) return;
    if (
      !confirm(
        `Delete "${current.name}"? Encounters, spell lists, and saved characters in this campaign will be removed from this browser.`,
      )
    )
      return;
    campaigns.deleteCampaign(current.id);
    setActiveId(null);
    leaveScopedPage();
  };
  const newEncounter = () => {
    const encounter: Encounter = {
      id: uid(),
      name: `Encounter ${campaigns.encounters.length + 1}`,
      archived: false,
      createdAt: Date.now(),
      combatants: [],
    };
    campaigns.setEncounters((all) => [...all, encounter]);
    setActiveId(encounter.id);
    void navigate({ to: "/" });
  };
  const addCharacter = (role: CharacterRole) => {
    const created = makeCharacter(role);
    campaigns.setCharacters((all) => [...all, created]);
    void navigate({ to: "/party", search: { id: created.id } });
  };
  const newFavorite = () => {
    const id = uid();
    campaigns.setLists((all) => [...all, { id, name: "New list", spellIds: [] }]);
    void navigate({ to: "/spells", search: { list: id } });
  };
  const navClass =
    "flex h-auto min-h-9 w-full justify-between gap-2 whitespace-normal rounded-lg px-2.5 py-2 text-left text-sm font-normal";
  const activeClass = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground";
  const inactiveClass = "hover:bg-primary/[0.06]";

  return (
    <WorkspaceContext.Provider value={{ ...campaigns, activeId, setActiveId, newEncounter }}>
      <div className="flex h-screen w-full bg-background text-foreground">
        <aside
          aria-label="Main navigation"
          className={cn(
            "flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none",
            open ? "w-64" : "w-14",
          )}
        >
          <div
            className={cn(
              "flex items-start border-b border-border py-4",
              open ? "justify-between gap-1 px-3" : "justify-center",
            )}
          >
            {open && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 px-1">
                  <p className="label-caps text-[10px]">Campaign</p>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="New campaign"
                      title="New campaign"
                      onClick={createCampaign}
                      disabled={!campaigns.ready}
                    >
                      <Plus />
                    </Button>
                    {campaigns.campaigns.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Delete campaign"
                        title="Delete campaign"
                        onClick={deleteCampaign}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
                <select
                  aria-label="Campaign"
                  className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                  value={campaigns.campaignId ?? ""}
                  disabled={!campaigns.ready}
                  onChange={(e) => chooseCampaign(e.target.value)}
                >
                  {campaigns.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Untitled campaign"}
                    </option>
                  ))}
                </select>
                <Textarea
                  ref={nameRef}
                  aria-label="Campaign name"
                  value={campaigns.campaign?.name ?? ""}
                  rows={2}
                  disabled={!campaigns.ready}
                  onChange={(e) => campaigns.renameCampaign(e.target.value.replace(/\n/g, " "))}
                  onBlur={() => {
                    if (campaigns.ready && !campaigns.campaign?.name.trim())
                      campaigns.renameCampaign(DEFAULT_CAMPAIGN_NAME);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  className="mt-1 min-h-0 w-full resize-none border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-semibold leading-6 shadow-none hover:border-input focus-visible:border-primary focus-visible:ring-0 disabled:opacity-100 md:text-lg"
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={open ? "Hide menu" : "Show menu"}
              title={open ? "Hide menu" : "Show menu"}
              onClick={() => setOpen(!open)}
            >
              {open ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          {open ? (
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <h2 className="label-caps mb-1.5 px-2.5">Encounters</h2>
              {campaigns.encounters.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">No encounters yet.</p>
              )}
              <ul className="space-y-1">
                {campaigns.encounters.map((e) => (
                  <li key={e.id}>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        navClass,
                        !isSpells && active?.id === e.id ? activeClass : inactiveClass,
                        e.archived && "text-muted-foreground",
                      )}
                    >
                      <Link
                        to="/"
                        onClick={() => setActiveId(e.id)}
                        aria-current={!isSpells && active?.id === e.id ? "page" : undefined}
                      >
                        <span className="min-w-0 truncate">{e.name}</span>
                        {e.archived ? (
                          <Archive className="text-muted-foreground" />
                        ) : (e.round ?? 0) > 0 ? (
                          <span
                            className="font-mono text-[10.5px] text-wine-ink"
                            title={`Round ${e.round}`}
                          >
                            R{e.round}
                          </span>
                        ) : null}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="mt-1 w-full justify-start px-2.5 font-normal text-muted-foreground"
                onClick={newEncounter}
              >
                <Plus /> New encounter
              </Button>
              <h2 className="label-caps mb-1.5 mt-6 px-2.5">Spells</h2>
              <Button
                asChild
                variant="ghost"
                className={cn(navClass, isSpells && !selectedList ? activeClass : inactiveClass)}
              >
                <Link
                  to="/spells"
                  search={{}}
                  aria-current={isSpells && !selectedList ? "page" : undefined}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen /> Spell Book
                  </span>
                </Link>
              </Button>
              <ul className="mt-1 space-y-1">
                {campaigns.lists.map((l) => (
                  <li key={l.id}>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        navClass,
                        isSpells && selectedList === l.id ? activeClass : inactiveClass,
                      )}
                    >
                      <Link
                        to="/spells"
                        search={{ list: l.id }}
                        aria-current={isSpells && selectedList === l.id ? "page" : undefined}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Bookmark />
                          <span className="truncate">{l.name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {l.spellIds.length}
                        </span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="mt-1 w-full justify-start px-2.5 font-normal text-muted-foreground"
                onClick={newFavorite}
              >
                <Plus /> New list
              </Button>
              <CharacterNav
                title="Party"
                people={campaigns.characters.filter((c) => c.role === "pc")}
                selectedId={isParty ? selectedCharacter : undefined}
                activeClass={activeClass}
                inactiveClass={inactiveClass}
                navClass={navClass}
                onOpen={(id) => void navigate({ to: "/party", search: { id } })}
                onAdd={() => addCharacter("pc")}
                addLabel="New character"
              />
              <CharacterNav
                title="NPCs"
                people={campaigns.characters.filter((c) => c.role === "npc")}
                selectedId={isParty ? selectedCharacter : undefined}
                activeClass={activeClass}
                inactiveClass={inactiveClass}
                navClass={navClass}
                onOpen={(id) => void navigate({ to: "/party", search: { id } })}
                onAdd={() => addCharacter("npc")}
                addLabel="New NPC"
              />
            </nav>
          ) : (
            <nav className="flex flex-col items-center gap-2 py-3">
              <Button asChild variant="ghost" size="icon" title="Encounters">
                <Link to="/" aria-label="Encounters">
                  <Swords />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" title="Spell Book">
                <Link to="/spells" search={{}} aria-label="Spell Book">
                  <BookOpen />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" title="Party">
                <Link to="/party" search={{}} aria-label="Party">
                  <Users />
                </Link>
              </Button>
            </nav>
          )}
        </aside>
        <div key={campaigns.campaignId ?? "pending"} className="flex min-w-0 flex-1">
          {children}
        </div>
      </div>
      <Toaster position="bottom-right" />
    </WorkspaceContext.Provider>
  );
}

function CharacterNav({
  title,
  people,
  selectedId,
  activeClass,
  inactiveClass,
  navClass,
  onOpen,
  onAdd,
  addLabel,
}: {
  title: string;
  people: { id: string; name: string; race: string; classes: string }[];
  selectedId: string | undefined;
  activeClass: string;
  inactiveClass: string;
  navClass: string;
  onOpen: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <>
      <h2 className="label-caps mb-1.5 mt-6 px-2.5">{title}</h2>
      <ul className="space-y-1">
        {people.map((c) => (
          <li key={c.id}>
            <Button
              variant="ghost"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/x-dm-character", c.id)}
              onClick={() => onOpen(c.id)}
              title={identity(c)}
              className={cn(navClass, selectedId === c.id ? activeClass : inactiveClass)}
              aria-current={selectedId === c.id ? "page" : undefined}
            >
              <span className="min-w-0 truncate">{c.name}</span>
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        className="mt-1 w-full justify-start px-2.5 font-normal text-muted-foreground"
        onClick={onAdd}
      >
        <Plus /> {addLabel}
      </Button>
    </>
  );
}
