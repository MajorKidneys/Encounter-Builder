import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Link } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";
import { uid, type Encounter } from "@/lib/encounters";
import {
  addFolder,
  ancestorFolderIds,
  buildTree,
  canCreateFolderIn,
  deleteFolder,
  moveItem,
  visibleRows,
  type EncounterFolder,
  type ItemRef,
  type Row,
} from "@/lib/folders";
import { resolveDrop, rowKey, type DropTarget, type RowGeometry } from "@/lib/treeDrop";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPEN_KEY = "dm-folder-open-v1";
const INDENT = 14;
const KEY_STEP = 18;

// Whether a folder is open is a viewing preference, kept out of the shared campaign data.
function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function useFolderOpen() {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => setSaved(readOpen()), []);
  const isOpen = (id: string) => saved[id] !== false;
  const setOpen = (id: string, open: boolean) =>
    setSaved((prev) => {
      const next = { ...prev, [id]: open };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: open }));
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  return { isOpen, setOpen };
}

const refOf = (row: Row): ItemRef =>
  row.node.type === "folder"
    ? { kind: "folder", id: row.node.folder.id }
    : { kind: "encounter", id: row.node.encounter.id };

type Props = {
  folders: EncounterFolder[];
  encounters: Encounter[];
  setFolders: (fn: (all: EncounterFolder[]) => EncounterFolder[]) => void;
  setEncounters: (fn: (all: Encounter[]) => Encounter[]) => void;
  activeId: string | undefined;
  showActive: boolean;
  onSelect: (id: string) => void;
  onCreateEncounter: (folderId: string | null) => void;
  newFolderSignal: number;
  navClass: string;
  activeClass: string;
  inactiveClass: string;
};

export function EncounterTree({
  folders,
  encounters,
  setFolders,
  setEncounters,
  activeId,
  showActive,
  onSelect,
  onCreateEncounter,
  newFolderSignal,
  navClass,
  activeClass,
  inactiveClass,
}: Props) {
  const { isOpen, setOpen } = useFolderOpen();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragged, setDragged] = useState<ItemRef | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const state = useMemo(() => ({ folders, encounters }), [folders, encounters]);
  const tree = useMemo(() => buildTree(state), [state]);
  const rows = useMemo(() => visibleRows(tree, isOpen), [tree, isOpen]);
  const active = encounters.find((e) => e.id === activeId);

  useEffect(() => {
    for (const id of ancestorFolderIds(folders, active)) setOpen(id, true);
    // Open the path to the selected encounter when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const createFolder = (parentId: string | null) => {
    if (!canCreateFolderIn(folders, parentId)) return;
    const id = uid();
    const next = addFolder(state, { id, name: "New folder", parentId });
    setFolders(() => next.folders);
    if (parentId) setOpen(parentId, true);
    setRenaming(id);
  };
  const lastSignal = useRef(newFolderSignal);
  useEffect(() => {
    if (newFolderSignal === lastSignal.current) return;
    lastSignal.current = newFolderSignal;
    createFolder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFolderSignal]);

  const rename = (id: string, name: string) => {
    setRenaming(null);
    const clean = name.trim();
    if (clean) setFolders((all) => all.map((f) => (f.id === id ? { ...f, name: clean } : f)));
  };
  const remove = (id: string) => {
    const next = deleteFolder(state, id);
    setFolders(() => next.folders);
    setEncounters(() => next.encounters);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
      coordinateGetter: (event, { currentCoordinates }) => {
        if (event.code === "ArrowDown")
          return { ...currentCoordinates, y: currentCoordinates.y + KEY_STEP };
        if (event.code === "ArrowUp")
          return { ...currentCoordinates, y: currentCoordinates.y - KEY_STEP };
        return undefined;
      },
    }),
  );

  const geometry = (): RowGeometry[] => {
    const out: RowGeometry[] = [];
    const byKey = new Map(rows.map((r) => [rowKey(refOf(r)), r]));
    const rootOf = new Map<string, ItemRef>();
    for (const r of rows) {
      const ref = refOf(r);
      rootOf.set(rowKey(ref), r.parentId === null ? ref : rootOf.get(`folder:${r.parentId}`)!);
    }
    listRef.current?.querySelectorAll<HTMLElement>("[data-row-key]").forEach((el) => {
      const row = byKey.get(el.getAttribute("data-row-key") ?? "");
      if (!row) return;
      const box = el.getBoundingClientRect();
      const ref = refOf(row);
      out.push({
        ref,
        parentId: row.parentId,
        root: rootOf.get(rowKey(ref)) ?? ref,
        openFolder: row.node.type === "folder" && isOpen(row.node.folder.id),
        top: box.top,
        bottom: box.bottom,
      });
    });
    return out.sort((a, b) => a.top - b.top);
  };

  const probe = (event: DragMoveEvent) => {
    const list = listRef.current?.getBoundingClientRect();
    if (!dragged || !list) return null;
    if (pointer.current) {
      const x = pointer.current.x + event.delta.x;
      const y = pointer.current.y + event.delta.y;
      return resolveDrop(state, geometry(), dragged, y, x < list.left + 14);
    }
    const box = event.active.rect.current.translated;
    if (!box) return null;
    return resolveDrop(state, geometry(), dragged, box.top + box.height / 2, false);
  };

  const onStart = (event: DragStartEvent) => {
    const [kind, ...rest] = String(event.active.id).split(":");
    setDragged({ kind: kind as ItemRef["kind"], id: rest.join(":") });
    const e = event.activatorEvent;
    pointer.current =
      typeof PointerEvent !== "undefined" && e instanceof PointerEvent
        ? { x: e.clientX, y: e.clientY }
        : null;
  };
  const onMove = (event: DragMoveEvent) => setTarget(probe(event));
  const reset = () => {
    setDragged(null);
    setTarget(null);
    pointer.current = null;
  };
  const onEnd = (event: DragEndEvent) => {
    const hit = target;
    const item = dragged;
    reset();
    if (!hit || !item) return;
    const next = moveItem(state, item, hit.parentId, hit.index);
    if (next.folders !== folders) setFolders(() => next.folders);
    if (next.encounters !== encounters) setEncounters(() => next.encounters);
    if (hit.mark.key !== "end" && hit.mark.edge === "into" && hit.parentId)
      setOpen(hit.parentId, true);
    void event;
  };

  // A closed folder springs open when you hover it long enough to mean it.
  useEffect(() => {
    if (!target || target.mark.key === "end" || target.mark.edge !== "into") return;
    const id = target.mark.key.replace(/^folder:/, "");
    if (isOpen(id)) return;
    const timer = setTimeout(() => setOpen(id, true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.mark.key, target?.mark.edge]);

  const draggedName = dragged
    ? dragged.kind === "folder"
      ? folders.find((f) => f.id === dragged.id)?.name
      : encounters.find((e) => e.id === dragged.id)?.name
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onStart}
      onDragMove={onMove}
      onDragEnd={onEnd}
      onDragCancel={reset}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Press Space to pick up. Arrow keys move it, Space drops it, Escape cancels.",
        },
      }}
    >
      {rows.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">No encounters yet.</p>
      )}
      <ul ref={listRef} className="space-y-1">
        {rows.map((row) => {
          const ref = refOf(row);
          const key = rowKey(ref);
          const mark = target?.mark.key === key ? target.mark.edge : null;
          const common = {
            depth: row.depth,
            mark,
            isDragging: dragged !== null && rowKey(dragged) === key,
          };
          const { node } = row;
          if (node.type === "encounter")
            return (
              <EncounterRow
                key={key}
                encounter={node.encounter}
                current={showActive && active?.id === node.encounter.id}
                onSelect={onSelect}
                navClass={navClass}
                activeClass={activeClass}
                inactiveClass={inactiveClass}
                {...common}
              />
            );
          const id = node.folder.id;
          return (
            <FolderRow
              key={key}
              folder={node.folder}
              count={node.count}
              open={isOpen(id)}
              renaming={renaming === id}
              canNest={canCreateFolderIn(folders, id)}
              dropGain={mark === "into" && dragged !== null && !isInside(state, dragged, id)}
              onToggle={() => setOpen(id, !isOpen(id))}
              onRename={(name) => rename(id, name)}
              onStartRename={() => setRenaming(id)}
              onNewEncounter={() => {
                setOpen(id, true);
                onCreateEncounter(id);
              }}
              onNewFolder={() => createFolder(id)}
              onDelete={() => remove(id)}
              {...common}
            />
          );
        })}
        {target?.mark.key === "end" && <li aria-hidden className="h-0.5 rounded bg-primary" />}
      </ul>
      <DragOverlay dropAnimation={null}>
        {draggedName !== undefined && (
          <div className="flex w-56 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm shadow-lg">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{draggedName}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function isInside(
  state: { folders: EncounterFolder[]; encounters: Encounter[] },
  item: ItemRef,
  folderId: string,
) {
  if (item.kind === "folder")
    return state.folders.find((f) => f.id === item.id)?.parentId === folderId;
  return state.encounters.find((e) => e.id === item.id)?.folderId === folderId;
}

type RowCommon = { depth: number; mark: "before" | "after" | "into" | null; isDragging: boolean };

function DropLine({ mark }: { mark: RowCommon["mark"] }) {
  if (mark !== "before" && mark !== "after") return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex items-center",
        mark === "before" ? "-top-[3px]" : "-bottom-[3px]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full border border-primary bg-card" />
      <span className="h-0.5 flex-1 rounded bg-primary" />
    </span>
  );
}

function EncounterRow({
  encounter,
  current,
  onSelect,
  navClass,
  activeClass,
  inactiveClass,
  depth,
  mark,
  isDragging,
}: RowCommon & {
  encounter: Encounter;
  current: boolean;
  onSelect: (id: string) => void;
  navClass: string;
  activeClass: string;
  inactiveClass: string;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `encounter:${encounter.id}` });
  return (
    <li
      data-row-key={`encounter:${encounter.id}`}
      className="relative"
      style={{ paddingLeft: depth * INDENT }}
    >
      <DropLine mark={mark} />
      <Button
        asChild
        variant="ghost"
        className={cn(
          navClass,
          current ? activeClass : inactiveClass,
          encounter.archived && "text-muted-foreground",
          isDragging && "border border-dashed border-border opacity-40",
        )}
      >
        <Link
          ref={setNodeRef}
          to="/"
          draggable={false}
          onClick={() => onSelect(encounter.id)}
          aria-current={current ? "page" : undefined}
          {...attributes}
          role={undefined}
          {...listeners}
        >
          <span className="min-w-0 truncate">{encounter.name}</span>
          {encounter.archived ? (
            <Archive className="text-muted-foreground" />
          ) : (encounter.round ?? 0) > 0 ? (
            <span
              className="font-mono text-[10.5px] text-wine-ink"
              title={`Round ${encounter.round}`}
            >
              R{encounter.round}
            </span>
          ) : null}
        </Link>
      </Button>
    </li>
  );
}

function FolderRow({
  folder,
  count,
  open,
  renaming,
  canNest,
  dropGain,
  onToggle,
  onRename,
  onStartRename,
  onNewEncounter,
  onNewFolder,
  onDelete,
  depth,
  mark,
  isDragging,
}: RowCommon & {
  folder: EncounterFolder;
  count: number;
  open: boolean;
  renaming: boolean;
  canNest: boolean;
  dropGain: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onStartRename: () => void;
  onNewEncounter: () => void;
  onNewFolder: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `folder:${folder.id}`,
    disabled: renaming,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const into = mark === "into";
  const Icon = open ? FolderOpen : Folder;
  const Chevron = open ? ChevronDown : ChevronRight;

  const menu = (Item: ElementType, Sep: ElementType) => (
    <>
      <Item onSelect={onNewEncounter}>New encounter here</Item>
      <Item onSelect={onNewFolder} disabled={!canNest}>
        {canNest ? "New folder inside" : "Folders nest 3 deep"}
      </Item>
      <Item onSelect={onStartRename}>Rename</Item>
      <Sep />
      <Item
        onSelect={onDelete}
        className="flex-col items-start text-destructive focus:bg-destructive/10 focus:text-destructive"
      >
        Delete folder
        <span className="text-[11px] font-normal text-muted-foreground">
          Its encounters move up a level
        </span>
      </Item>
    </>
  );

  return (
    <li
      data-row-key={`folder:${folder.id}`}
      className="relative"
      style={{ paddingLeft: depth * INDENT }}
    >
      <DropLine mark={mark} />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group relative flex min-h-9 items-center rounded-lg border border-transparent hover:bg-primary/[0.06]",
              into && "border-primary bg-primary/15",
              isDragging && "border-dashed border-border opacity-40",
            )}
          >
            {renaming ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  aria-label="Folder name"
                  autoFocus
                  defaultValue={folder.name}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => onRename(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = folder.name;
                      e.currentTarget.blur();
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-primary bg-card px-1.5 py-0.5 text-sm font-semibold outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                ref={setNodeRef}
                aria-expanded={open}
                onClick={onToggle}
                {...attributes}
                role={undefined}
                {...listeners}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 text-left text-sm font-semibold"
              >
                <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{folder.name}</span>
                <span className="ml-auto pr-6 font-mono text-[11px] font-normal text-muted-foreground group-hover:invisible">
                  {dropGain ? `${count} → ${count + 1}` : count}
                </span>
              </button>
            )}
            {!renaming && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${folder.name} folder menu`}
                    className={cn(
                      "absolute right-1 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100",
                      menuOpen && "opacity-100",
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {menu(DropdownMenuItem, DropdownMenuSeparator)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {menu(ContextMenuItem, ContextMenuSeparator)}
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}
