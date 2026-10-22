import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  BookOpen,
  Bookmark,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  FolderPlus,
  Plus,
  Settings,
  Swords,
  Users,
} from "lucide-react";
import { uid, type Encounter } from "@/lib/encounters";
import {
  beginCharacterDrag,
  endCharacterDrag,
  identity,
  makeCharacter,
  type CharacterRole,
} from "@/lib/characters";
import { useCampaignStore } from "@/lib/campaigns";
import { CampaignSwitcher } from "@/components/CampaignSwitcher";
import { EncounterTree } from "@/components/EncounterTree";
import { nextSort } from "@/lib/folders";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ReferenceProvider, useReference } from "@/components/reference/ReferenceLayer";
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Tombstone } from "@/components/Tombstone";

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
  const [theme, setTheme] = useState<ThemeChoice>("auto");
  const [renameArmed, setRenameArmed] = useState(false);
  const [folderSignal, setFolderSignal] = useState(0);
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const isSpells = location.pathname === "/spells";
  const isParty = location.pathname === "/party";
  const selectedList = (location.search as { list?: string }).list;
  const selectedCharacter = (location.search as { id?: string }).id;
  const active = campaigns.encounters.find((e) => e.id === activeId) ?? campaigns.encounters[0];

  useEffect(() => {
    const choice = readTheme();
    setTheme(choice);
    applyTheme(choice);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "auto") applyTheme("auto");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

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
  const createEncounter = (folderId: string | null = null) => {
    const sort = nextSort(
      { folders: campaigns.folders, encounters: campaigns.encounters },
      folderId,
    );
    const encounter: Encounter = {
      id: uid(),
      name: `Encounter ${campaigns.encounters.length + 1}`,
      archived: false,
      createdAt: Date.now(),
      combatants: [],
      ...(folderId ? { folderId } : {}),
      sort,
    };
    campaigns.setEncounters((all) => [...all, encounter]);
    setActiveId(encounter.id);
    void navigate({ to: "/" });
  };
  const newEncounter = () => createEncounter();
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
      <ReferenceProvider>
        <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground">
          <aside
            aria-label="Main navigation"
            className={cn(
              "flex h-full min-h-0 shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none",
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
                    </div>
                  </div>
                  <CampaignSwitcher
                    ready={campaigns.ready}
                    campaigns={campaigns.campaigns}
                    activeId={campaigns.campaignId}
                    name={campaigns.campaign?.name ?? ""}
                    renameArmed={renameArmed}
                    onRenameArmed={() => setRenameArmed(false)}
                    onChoose={chooseCampaign}
                    onRename={campaigns.renameCampaign}
                    onCreate={createCampaign}
                    onDelete={deleteCampaign}
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
                <div className="mb-1.5 flex items-center justify-between px-2.5">
                  <h2 className="label-caps">Encounters</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-my-1 h-7 w-7"
                    aria-label="New folder"
                    title="New folder"
                    onClick={() => setFolderSignal((n) => n + 1)}
                  >
                    <FolderPlus />
                  </Button>
                </div>
                <EncounterTree
                  folders={campaigns.folders}
                  encounters={campaigns.encounters}
                  setFolders={campaigns.setFolders}
                  setEncounters={campaigns.setEncounters}
                  activeId={active?.id}
                  showActive={!isSpells && !isParty}
                  onSelect={setActiveId}
                  onCreateEncounter={createEncounter}
                  newFolderSignal={folderSignal}
                  navClass={navClass}
                  activeClass={activeClass}
                  inactiveClass={inactiveClass}
                />
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
              <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
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
            <div
              className={cn(
                "mt-auto border-t border-border p-2",
                !open && "flex flex-col items-center gap-1",
              )}
            >
              <ReferenceButton open={open} />
              <ThemeSettings
                open={open}
                theme={theme}
                onChange={(choice) => {
                  setTheme(choice);
                  writeTheme(choice);
                }}
              />
            </div>
          </aside>
          <div
            key={campaigns.campaignId ?? "pending"}
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            {children}
          </div>
        </div>
        <Toaster position="bottom-right" />
      </ReferenceProvider>
    </WorkspaceContext.Provider>
  );
}

function ReferenceButton({ open }: { open: boolean }) {
  const { toggle, open: drawerOpen } = useReference();
  return (
    <Button
      variant="ghost"
      size={open ? "default" : "icon"}
      aria-label="Reference"
      aria-expanded={drawerOpen}
      title="Reference (⌘/)"
      data-reference-trigger
      onClick={toggle}
      className={cn(open && "mb-1 w-full justify-start px-2.5 font-normal")}
    >
      <Library />
      {open && (
        <>
          <span className="flex-1 text-left">Reference</span>
          <kbd className="font-mono text-[10px] text-muted-foreground">⌘/</kbd>
        </>
      )}
    </Button>
  );
}

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];

function ThemeSettings({
  open,
  theme,
  onChange,
}: {
  open: boolean;
  theme: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  const { tooltips, setTooltips } = useReference();
  return (
    <div className={cn(open ? "" : "flex justify-center")}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size={open ? "default" : "icon"}
            aria-label="Settings"
            title="Settings"
            className={cn(open && "w-full justify-start px-2.5 font-normal")}
          >
            <Settings />
            {open && "Settings"}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-52 p-3">
          <p className="label-caps mb-2">Appearance</p>
          <div role="radiogroup" aria-label="Appearance" className="grid gap-1">
            {THEMES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={theme === choice.id}
                onClick={() => onChange(choice.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent",
                  theme === choice.id && "bg-accent font-semibold",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <div className="my-2 border-t border-border" />
          <div
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => setTooltips(!tooltips)}
          >
            <span id="rules-tooltips-label">Rules tooltips</span>
            <Switch
              checked={tooltips}
              aria-labelledby="rules-tooltips-label"
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={setTooltips}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
  people: { id: string; name: string; race: string; classes: string; dead?: boolean | undefined }[];
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
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                beginCharacterDrag(c.id);
                e.dataTransfer.setData("text/plain", c.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={endCharacterDrag}
              onClick={() => onOpen(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(c.id);
              }}
              title={identity(c)}
              className={cn(
                "cursor-grab",
                navClass,
                selectedId === c.id ? activeClass : inactiveClass,
              )}
              aria-current={selectedId === c.id ? "page" : undefined}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {c.dead && (
                  <span title="Dead" className="shrink-0 text-muted-foreground">
                    <Tombstone />
                    <span className="sr-only">Dead</span>
                  </span>
                )}
                <span className="min-w-0 truncate">{c.name}</span>
              </span>
            </div>
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
