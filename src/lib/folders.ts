import { type Encounter } from "./encounters";

/** A named group of encounters, such as one branch of the adventure. Lives in `dm-c-<id>-folders`. */
export type EncounterFolder = { id: string; name: string; parentId: string | null; sort: number };

/** Folder levels, so "choice → consequence → follow-up" fits and nothing nests forever. */
export const MAX_DEPTH = 3;
const MIN_GAP = 1e-6;

export type TreeNode =
  | { type: "folder"; folder: EncounterFolder; children: TreeNode[]; count: number }
  | { type: "encounter"; encounter: Encounter };

export type ItemRef = { kind: "folder" | "encounter"; id: string };

export type FolderState = { folders: EncounterFolder[]; encounters: Encounter[] };

const knownParent = (folders: EncounterFolder[], id: string | null | undefined) =>
  id && folders.some((f) => f.id === id) ? id : null;

/** Where an encounter really sits: a folder that no longer exists means top level. */
export const encounterParent = (folders: EncounterFolder[], e: Encounter) =>
  knownParent(folders, e.folderId);

const folderParent = (folders: EncounterFolder[], f: EncounterFolder) =>
  f.parentId !== f.id ? knownParent(folders, f.parentId) : null;

type Sibling = { ref: ItemRef; sort: number; order: number };

/** The children of one parent, in display order. A missing `sort` falls back to list position. */
export function siblingsOf(state: FolderState, parentId: string | null): Sibling[] {
  const out: Sibling[] = [];
  state.folders.forEach((f, i) => {
    if (folderParent(state.folders, f) === parentId)
      out.push({ ref: { kind: "folder", id: f.id }, sort: f.sort ?? i, order: i });
  });
  state.encounters.forEach((e, i) => {
    if (encounterParent(state.folders, e) === parentId)
      out.push({ ref: { kind: "encounter", id: e.id }, sort: e.sort ?? i, order: i });
  });
  return out.sort(
    (a, b) =>
      a.sort - b.sort ||
      (a.ref.kind === b.ref.kind ? a.order - b.order : a.ref.kind === "folder" ? -1 : 1),
  );
}

export function buildTree(
  state: FolderState,
  parentId: string | null = null,
  seen = new Set<string>(),
): TreeNode[] {
  return siblingsOf(state, parentId).flatMap((s): TreeNode[] => {
    if (s.ref.kind === "encounter") {
      const encounter = state.encounters.find((e) => e.id === s.ref.id)!;
      return [{ type: "encounter", encounter }];
    }
    if (seen.has(s.ref.id)) return [];
    const folder = state.folders.find((f) => f.id === s.ref.id)!;
    const children = buildTree(state, folder.id, new Set(seen).add(folder.id));
    const count = children.reduce((n, c) => n + (c.type === "encounter" ? 1 : c.count), 0);
    return [{ type: "folder", folder, children, count }];
  });
}

/** 1 for a top-level folder, 2 for one inside it, and so on. 0 for the top level itself. */
export function folderDepth(folders: EncounterFolder[], id: string | null): number {
  let depth = 0;
  let cursor = id;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const f = folders.find((x) => x.id === cursor);
    if (!f) break;
    depth += 1;
    cursor = f.parentId;
  }
  return depth;
}

/** How many folder levels this folder and everything under it span (1 for a folder with no subfolders). */
export function subtreeHeight(folders: EncounterFolder[], id: string): number {
  const kids = folders.filter((f) => f.parentId === id && f.id !== id);
  return 1 + Math.max(0, ...kids.map((k) => subtreeHeight(folders, k.id)));
}

export const isDescendant = (folders: EncounterFolder[], id: string, maybeAncestor: string) => {
  let cursor: string | null = folders.find((f) => f.id === id)?.parentId ?? null;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === maybeAncestor) return true;
    seen.add(cursor);
    cursor = folders.find((f) => f.id === cursor)?.parentId ?? null;
  }
  return false;
};

export const canCreateFolderIn = (folders: EncounterFolder[], parentId: string | null) =>
  folderDepth(folders, parentId) + 1 <= MAX_DEPTH;

/** Encounters can go anywhere. A folder cannot go into itself, below itself, or past the depth cap. */
export function canMove(
  folders: EncounterFolder[],
  item: ItemRef,
  parentId: string | null,
): boolean {
  if (item.kind === "encounter") return parentId === null || folders.some((f) => f.id === parentId);
  if (parentId === item.id) return false;
  if (
    parentId !== null &&
    (!folders.some((f) => f.id === parentId) || isDescendant(folders, parentId, item.id))
  )
    return false;
  return folderDepth(folders, parentId) + subtreeHeight(folders, item.id) <= MAX_DEPTH;
}

const withSort = (
  state: FolderState,
  ref: ItemRef,
  sort: number,
  parentId: string | null,
): FolderState =>
  ref.kind === "folder"
    ? {
        ...state,
        folders: state.folders.map((f) => (f.id === ref.id ? { ...f, sort, parentId } : f)),
      }
    : {
        ...state,
        encounters: state.encounters.map((e) =>
          e.id === ref.id ? { ...e, sort, folderId: parentId } : e,
        ),
      };

/** Gives every child of `parentId` a whole-number position in the order given. */
function renumber(state: FolderState, parentId: string | null, order: ItemRef[]): FolderState {
  return order.reduce((acc, ref, i) => withSort(acc, ref, i + 1, parentId), state);
}

/**
 * Moves `item` under `parentId`, to sit at `index` among that parent's other children.
 * Sorts are fractional so a move touches one row; if the neighbors are too close or unnumbered,
 * the parent's children are renumbered instead.
 */
export function moveItem(
  state: FolderState,
  item: ItemRef,
  parentId: string | null,
  index: number,
): FolderState {
  if (!canMove(state.folders, item, parentId)) return state;
  const others = siblingsOf(state, parentId).filter(
    (s) => !(s.ref.kind === item.kind && s.ref.id === item.id),
  );
  const at = Math.max(0, Math.min(index, others.length));
  const before = others[at - 1];
  const after = others[at];
  const explicit = (s: Sibling | undefined) => {
    if (!s) return true;
    const row =
      s.ref.kind === "folder"
        ? state.folders.find((f) => f.id === s.ref.id)
        : state.encounters.find((e) => e.id === s.ref.id);
    return row?.sort !== undefined;
  };
  const gapOk = !before || !after || after.sort - before.sort >= MIN_GAP * 2;
  if (!explicit(before) || !explicit(after) || !gapOk) {
    const order = others.map((s) => s.ref);
    order.splice(at, 0, item);
    return renumber(state, parentId, order);
  }
  const sort =
    before && after
      ? (before.sort + after.sort) / 2
      : before
        ? before.sort + 1
        : after
          ? after.sort - 1
          : 1;
  return withSort(state, item, sort, parentId);
}

/** New items go last in their parent. */
export const appendIndex = (state: FolderState, parentId: string | null) =>
  siblingsOf(state, parentId).length;

/** Moves an item to the end of a parent's children. */
export const moveToEnd = (state: FolderState, item: ItemRef, parentId: string | null) =>
  moveItem(state, item, parentId, Number.MAX_SAFE_INTEGER);

/**
 * Removes a folder. Its encounters and subfolders move up to its parent, in the folder's place.
 * Nothing is deleted, so no confirmation is needed.
 */
export function deleteFolder(state: FolderState, id: string): FolderState {
  const folder = state.folders.find((f) => f.id === id);
  if (!folder) return state;
  const parentId = folderParent(state.folders, folder);
  const parentOrder = siblingsOf(state, parentId).map((s) => s.ref);
  const kids = siblingsOf(state, id).map((s) => s.ref);
  const at = parentOrder.findIndex((r) => r.kind === "folder" && r.id === id);
  parentOrder.splice(at, 1, ...kids);
  const without: FolderState = { ...state, folders: state.folders.filter((f) => f.id !== id) };
  return renumber(without, parentId, parentOrder);
}

export function addFolder(state: FolderState, folder: Omit<EncounterFolder, "sort">): FolderState {
  const sort = siblingsOf(state, folder.parentId).reduce((m, s) => Math.max(m, s.sort), 0) + 1;
  return { ...state, folders: [...state.folders, { ...folder, sort }] };
}

/** "Fight the band / Sent on the raid" for a folder. */
export function folderPath(folders: EncounterFolder[], id: string | null): string {
  const parts: string[] = [];
  let cursor = id;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const f = folders.find((x) => x.id === cursor);
    if (!f) break;
    parts.unshift(f.name);
    cursor = f.parentId;
  }
  return parts.join(" / ");
}

/** Splits "A / B / C" into its names. Blank parts are dropped. */
export const splitPath = (path: string) =>
  path
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The folder a path points at, or null when it does not exist yet. "" and [] mean top level. */
export function findFolderByPath(
  folders: EncounterFolder[],
  path: string[],
): { id: string | null } | null {
  let parent: string | null = null;
  for (const name of path) {
    const hit: EncounterFolder | undefined = folders.find(
      (f) => f.parentId === parent && same(f.name, name),
    );
    if (!hit) return null;
    parent = hit.id;
  }
  return { id: parent };
}

/**
 * Finds a folder path, creating whatever is missing. Throws a plain message when the path is
 * deeper than the app allows, so the caller can tell the GM exactly why.
 */
export function ensureFolderPath(
  state: FolderState,
  path: string[],
  makeId: () => string,
): { state: FolderState; id: string | null } {
  if (path.length > MAX_DEPTH)
    throw new Error(
      `Folders can nest ${MAX_DEPTH} levels deep, and "${path.join(" / ")}" is ${path.length}.`,
    );
  let next = state;
  let parent: string | null = null;
  for (const name of path) {
    const hit: EncounterFolder | undefined = next.folders.find(
      (f) => f.parentId === parent && same(f.name, name),
    );
    if (hit) {
      parent = hit.id;
      continue;
    }
    const id = makeId();
    next = addFolder(next, { id, name: name.trim(), parentId: parent });
    parent = id;
  }
  return { state: next, id: parent };
}

export type Row = { node: TreeNode; depth: number; parentId: string | null };

/** The rows the sidebar shows: closed folders hide their children. */
export function visibleRows(
  tree: TreeNode[],
  isOpen: (folderId: string) => boolean,
  depth = 0,
  parentId: string | null = null,
): Row[] {
  return tree.flatMap((node): Row[] => {
    const row: Row = { node, depth, parentId };
    if (node.type === "encounter" || !isOpen(node.folder.id)) return [row];
    return [row, ...visibleRows(node.children, isOpen, depth + 1, node.folder.id)];
  });
}

/** Folder ids from the top down that hold this encounter, so the active one can open itself. */
export function ancestorFolderIds(
  folders: EncounterFolder[],
  encounter: Encounter | undefined,
): string[] {
  const ids: string[] = [];
  let cursor = encounter ? encounterParent(folders, encounter) : null;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    ids.unshift(cursor);
    cursor = folders.find((f) => f.id === cursor)?.parentId ?? null;
  }
  return ids;
}
