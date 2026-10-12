import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Archive, BookOpen, PanelLeftClose, PanelLeftOpen, Plus, Star } from "lucide-react";
import { useEncounters, uid, type Encounter } from "@/lib/encounters";
import { useSpellLists } from "@/lib/spells";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type WorkspaceState = ReturnType<typeof useEncounters> & ReturnType<typeof useSpellLists> & {
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
  const encountersState = useEncounters();
  const spellListsState = useSpellLists();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [campaignName, setCampaignName] = useState("YOUR ADVENTURE");
  const [campaignLoaded, setCampaignLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dm-campaign-name-v1");
      if (saved?.trim()) setCampaignName(saved);
    } catch { /* Keep the default when storage is unavailable. */ }
    setCampaignLoaded(true);
  }, []);
  useEffect(() => {
    if (!campaignLoaded) return;
    try { localStorage.setItem("dm-campaign-name-v1", campaignName); } catch { /* Storage may be unavailable. */ }
  }, [campaignName, campaignLoaded]);
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const isSpells = location.pathname === "/spells";
  const selectedList = (location.search as { list?: string }).list;
  const active = encountersState.encounters.find((e) => e.id === activeId) ?? encountersState.encounters[0];
  const newEncounter = () => {
    const encounter: Encounter = { id: uid(), name: `Encounter ${encountersState.encounters.length + 1}`, archived: false, createdAt: Date.now(), combatants: [] };
    encountersState.setEncounters((all) => [...all, encounter]);
    setActiveId(encounter.id);
    void navigate({ to: "/" });
  };
  const newFavorite = () => {
    const id = uid();
    spellListsState.setLists((all) => [...all, { id, name: "New favorite", spellIds: [] }]);
    void navigate({ to: "/spells", search: { list: id } });
  };
  const navClass = "flex h-auto min-h-9 w-full justify-between whitespace-normal rounded-md border px-3 py-2 text-left text-sm";
  const activeClass = "border-border bg-accent font-medium";
  const inactiveClass = "border-transparent hover:bg-accent/60";

  return (
    <WorkspaceContext.Provider value={{ ...encountersState, ...spellListsState, activeId, setActiveId, newEncounter }}>
      <div className="flex h-screen w-full bg-background text-foreground">
        <aside aria-label="Main navigation" className={cn("flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none", open ? "w-64" : "w-14")}>
          <div className={cn("flex items-center border-b border-border py-4", open ? "justify-between gap-2 px-4" : "justify-center")}>
            {open && <Textarea
              aria-label="Campaign name"
              value={campaignName}
              rows={2}
              onChange={(e) => setCampaignName(e.target.value.replace(/\n/g, " "))}
              onBlur={() => { if (!campaignName.trim()) setCampaignName("YOUR ADVENTURE"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              className="h-20 min-h-20 min-w-0 flex-1 resize-none font-display text-lg leading-6 md:text-lg"
            />}
            <Button variant="ghost" size="icon" className="shrink-0" aria-label={open ? "Hide menu" : "Show menu"} title={open ? "Hide menu" : "Show menu"} onClick={() => setOpen(!open)}>
              {open ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          {open ? (
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <h2 className="mb-2 px-2 text-sm font-semibold uppercase text-muted-foreground">Encounters</h2>
              {encountersState.encounters.length === 0 && <p className="px-2 text-sm text-muted-foreground">No encounters yet.</p>}
              <ul className="space-y-1">
                {encountersState.encounters.map((e) => <li key={e.id}>
                  <Button asChild variant="ghost" className={cn(navClass, !isSpells && active?.id === e.id ? activeClass : inactiveClass, e.archived && "text-muted-foreground")}>
                    <Link to="/" onClick={() => setActiveId(e.id)} aria-current={!isSpells && active?.id === e.id ? "page" : undefined}>
                      <span className="min-w-0 truncate">{e.name}</span>{e.archived && <Archive />}
                    </Link>
                  </Button>
                </li>)}
              </ul>
              <Button variant="ghost" className="mt-1 w-full justify-start" onClick={newEncounter}><Plus /> New Encounter</Button>
              <h2 className="mb-2 mt-6 px-2 text-sm font-semibold uppercase text-muted-foreground">Spells</h2>
              <Button asChild variant="ghost" className={cn(navClass, isSpells && !selectedList ? activeClass : inactiveClass)}>
                <Link to="/spells" search={{}} aria-current={isSpells && !selectedList ? "page" : undefined}><span className="flex items-center gap-2"><BookOpen /> Spell Book</span></Link>
              </Button>
              <ul className="mt-1 space-y-1">
                {spellListsState.lists.map((l) => <li key={l.id}>
                  <Button asChild variant="ghost" className={cn(navClass, isSpells && selectedList === l.id ? activeClass : inactiveClass)}>
                    <Link to="/spells" search={{ list: l.id }} aria-current={isSpells && selectedList === l.id ? "page" : undefined}>
                      <span className="flex min-w-0 items-center gap-2"><Star /><span className="truncate">{l.name}</span></span><span className="text-muted-foreground">{l.spellIds.length}</span>
                    </Link>
                  </Button>
                </li>)}
              </ul>
              <Button variant="ghost" className="mt-1 w-full justify-start" onClick={newFavorite}><Plus /> Favorite</Button>
            </nav>
          ) : (
            <nav className="flex flex-col items-center gap-2 py-3">
              <Button asChild variant="ghost" size="icon" title="Encounters"><Link to="/" aria-label="Encounters"><Archive /></Link></Button>
              <Button asChild variant="ghost" size="icon" title="Spell Book"><Link to="/spells" search={{}} aria-label="Spell Book"><BookOpen /></Link></Button>
            </nav>
          )}
        </aside>
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </WorkspaceContext.Provider>
  );
}