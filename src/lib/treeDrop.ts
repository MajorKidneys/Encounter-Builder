import { canMove, isDescendant, siblingsOf, type FolderState, type ItemRef } from "./folders";

/** One visible sidebar row and where it sits on screen. */
export type RowGeometry = {
  ref: ItemRef;
  parentId: string | null;
  /** Top-level ancestor, or the row itself when it is already top level. */
  root: ItemRef;
  openFolder: boolean;
  top: number;
  bottom: number;
};

export type DropTarget = {
  parentId: string | null;
  index: number;
  /** What to draw: a line above or below a row, a highlight on a folder, or a line at the list's end. */
  mark: { key: string; edge: "before" | "after" | "into" } | { key: "end"; edge: "after" };
};

export const rowKey = (ref: ItemRef) => `${ref.kind}:${ref.id}`;
const sameRef = (a: ItemRef, b: ItemRef) => a.kind === b.kind && a.id === b.id;

/**
 * Turns a pointer height into a drop. The middle half of a folder drops into it; the top and
 * bottom quarters drop above or below. An encounter splits at its midline. Below the last row,
 * or in the left gutter, drops at the top level.
 */
export function resolveDrop(
  state: FolderState,
  rows: RowGeometry[],
  dragged: ItemRef,
  y: number,
  gutter: boolean,
): DropTarget | null {
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  const sortedFirst = rows[0]!;

  const place = (
    parentId: string | null,
    anchor: ItemRef | null,
    after: boolean,
    mark: DropTarget["mark"],
    forceIndex?: number,
  ) => {
    if (!canMove(state.folders, dragged, parentId)) return null;
    const siblings = siblingsOf(state, parentId).filter((s) => !sameRef(s.ref, dragged));
    const at = anchor ? siblings.findIndex((s) => sameRef(s.ref, anchor)) : siblings.length;
    if (at < 0) return null;
    const index = forceIndex ?? (anchor ? at + (after ? 1 : 0) : at);
    return { parentId, index, mark } satisfies DropTarget;
  };
  const atTopEnd = () => place(null, null, true, { key: "end", edge: "after" });

  if (y > last.bottom) return atTopEnd();
  const row =
    y < sortedFirst.top ? sortedFirst : (rows.find((r) => y >= r.top && y <= r.bottom) ?? last);

  if (gutter && row.parentId !== null) {
    if (sameRef(row.root, dragged)) return null;
    return place(null, row.root, true, { key: rowKey(row.root), edge: "after" });
  }

  if (sameRef(row.ref, dragged)) return null;
  if (dragged.kind === "folder") {
    const inside = (folderId: string | null) =>
      folderId !== null &&
      (folderId === dragged.id || isDescendant(state.folders, folderId, dragged.id));
    if (inside(row.parentId) || (row.ref.kind === "folder" && inside(row.ref.id))) return null;
  }

  const rel = (y - row.top) / Math.max(1, row.bottom - row.top);
  const key = rowKey(row.ref);
  if (row.ref.kind === "folder") {
    if (rel > 0.25 && rel < 0.75) return place(row.ref.id, null, true, { key, edge: "into" });
    if (rel >= 0.75 && row.openFolder)
      return place(row.ref.id, null, false, { key, edge: "into" }, 0);
  }
  const after = rel >= (row.ref.kind === "folder" ? 0.75 : 0.5);
  return place(row.parentId, row.ref, after, { key, edge: after ? "after" : "before" });
}
