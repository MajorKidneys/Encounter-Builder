import type { ReactNode } from "react";

/**
 * The page beside the sidebar. The detail drawer docks on the right when the
 * stage is wide enough to keep the center readable, and slides over the center
 * when it is not.
 */
export function Stage({ children, drawer }: { children: ReactNode; drawer: ReactNode }) {
  return (
    <div className="@container/stage relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {children}
      {drawer}
    </div>
  );
}

/** Panel chrome shared by the creature drawer and the character drawer. */
export const drawerPanelClass =
  "absolute inset-y-0 right-0 z-30 flex max-h-full w-[27rem] max-w-full min-h-0 shrink-0 flex-col overflow-y-auto overscroll-y-contain border-l border-border bg-background shadow-[-18px_0_40px_-28px_rgba(0,0,0,.45)] motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200 motion-reduce:animate-none @min-[72rem]/stage:static @min-[72rem]/stage:h-auto @min-[72rem]/stage:animate-none @min-[72rem]/stage:shadow-none";
