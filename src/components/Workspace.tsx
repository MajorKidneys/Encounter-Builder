import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Archive, BookOpen, Bookmark, PanelLeftClose, PanelLeftOpen, Plus, Swords } from "lucide-react";
import { useEncounters, uid, type Encounter } from "@/lib/encounters";
import { useSpellLists } from "@/lib/spells";
import { usePersistedState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

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
  const [campaignName, setCampaignName] = usePersistedState<string>("dm-campaign-name-v1", "YOUR ADVENTURE", {
    isValid: (v) => typeof v === "string" && v.trim() !== "",
  });
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
    spellListsState.setLists((all) => [...all, { id, name: "New list", spellIds: [] }]);
    void navigate({ to: "/spells", search: { list: id } });
  };
  const navClass = "flex h-auto min-h-9 w-full justify-between gap-2 whitespace-normal rounded-lg px-2.5 py-2 text-left text-sm font-normal";
  const activeClass = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground";
  const inactiveClass = "hover:bg-primary/[0.06]";

  return (
    <WorkspaceContext.Provider value={{ ...encountersState, ...spellListsState, activeId, setActiveId, newEncounter }}>
      <div className="flex h-screen w-full bg-background text-foreground">
        <aside aria-label="Main navigation" className={cn("flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none", open ? "w-64" : "w-14")}>
          <div className={cn("flex items-start border-b border-border py-4", open ? "justify-between gap-2 px-4" : "justify-center")}>
            {open && <div className="min-w-0 flex-1"><p className="label-caps px-1 text-[10px]">Campaign</p><Textarea
              aria-label="Campaign name"
              value={campaignName}
              rows={2}
              onChange={(e) => setCampaignName(e.target.value.replace(/\n/g, " "))}
              onBlur={() => { if (!campaignName.trim()) setCampaignName("YOUR ADVENTURE"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              className="min-h-0 w-full resize-none border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-semibold leading-6 shadow-none hover:border-input focus-visible:border-primary focus-visible:ring-0 md:text-lg"
            /></div>}
            <Button variant="ghost" size="icon" className="shrink-0" aria-label={open ? "Hide menu" : "Show menu"} title={open ? "Hide menu" : "Show menu"} onClick={() => setOpen(!open)}>
              {open ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          {open ? (
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <h2 className="label-caps mb-1.5 px-2.5">Encounters</h2>
              {encountersState.encounters.length === 0 && <p className="px-2 text-sm text-muted-foreground">No encounters yet.</p>}
              <ul className="space-y-1">
                {encountersState.encounters.map((e) => <li key={e.id}>
                  <Button asChild variant="ghost" className={cn(navClass, !isSpells && active?.id === e.id ? activeClass : inactiveClass, e.archived && "text-muted-foreground")}>
                    <Link to="/" onClick={() => setActiveId(e.id)} aria-current={!isSpells && active?.id === e.id ? "page" : undefined}>
                      <span className="min-w-0 truncate">{e.name}</span>
                      {e.archived ? <Archive className="text-muted-foreground" /> : (e.round ?? 0) > 0
                        ? <span className="font-mono text-[10.5px] text-wine-ink" title={`Round ${e.round}`}>R{e.round}</span>
                        : null}
                    </Link>
                  </Button>
                </li>)}
              </ul>
              <Button variant="ghost" className="mt-1 w-full justify-start px-2.5 font-normal text-muted-foreground" onClick={newEncounter}><Plus /> New encounter</Button>
              <h2 className="label-caps mb-1.5 mt-6 px-2.5">Spells</h2>
              <Button asChild variant="ghost" className={cn(navClass, isSpells && !selectedList ? activeClass : inactiveClass)}>
                <Link to="/spells" search={{}} aria-current={isSpells && !selectedList ? "page" : undefined}><span className="flex items-center gap-2"><BookOpen /> Spell Book</span></Link>
              </Button>
              <ul className="mt-1 space-y-1">
                {spellListsState.lists.map((l) => <li key={l.id}>
                  <Button asChild variant="ghost" className={cn(navClass, isSpells && selectedList === l.id ? activeClass : inactiveClass)}>
                    <Link to="/spells" search={{ list: l.id }} aria-current={isSpells && selectedList === l.id ? "page" : undefined}>
                      <span className="flex min-w-0 items-center gap-2"><Bookmark /><span className="truncate">{l.name}</span></span><span className="font-mono text-[11px] text-muted-foreground">{l.spellIds.length}</span>
                    </Link>
                  </Button>
                </li>)}
              </ul>
              <Button variant="ghost" className="mt-1 w-full justify-start px-2.5 font-normal text-muted-foreground" onClick={newFavorite}><Plus /> New list</Button>
            </nav>
          ) : (
            <nav className="flex flex-col items-center gap-2 py-3">
              <Button asChild variant="ghost" size="icon" title="Encounters"><Link to="/" aria-label="Encounters"><Swords /></Link></Button>
              <Button asChild variant="ghost" size="icon" title="Spell Book"><Link to="/spells" search={{}} aria-label="Spell Book"><BookOpen /></Link></Button>
            </nav>
          )}
        </aside>
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
      <Toaster position="bottom-right" />
    </WorkspaceContext.Provider>
  );
}