import { useEffect, useRef, useState, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getEntry } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { useReference } from "./ReferenceLayer";

const linkClass =
  "inline cursor-pointer border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-from-font underline-offset-[3px]";

function useTip() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const show = (delay: number) => {
    clear();
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(false), 100);
  };
  const keep = () => {
    clear();
    setOpen(true);
  };
  return { open, show, hide, keep };
}

function Tip({
  id,
  open,
  onKeep,
  onHide,
  children,
}: {
  id: string;
  open: boolean;
  onKeep: () => void;
  onHide: () => void;
  children: ReactNode;
}) {
  const entry = getEntry(id);
  const { openEntry } = useReference();
  if (!entry) return children;
  return (
    <HoverCard open={open}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-[min(20rem,calc(100vw-2rem))] p-3 text-left"
        onMouseEnter={onKeep}
        onMouseLeave={onHide}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">{entry.term}</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{entry.short}</p>
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-wine-ink hover:underline"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openEntry(id);
          }}
        >
          Click for full rules →
        </button>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Opens the glossary when rules tooltips are on. Off, it is plain text. */
export function RefTerm({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { tooltips, openEntry } = useReference();
  const tip = useTip();
  if (!tooltips || !getEntry(id)) return <span className={className}>{children}</span>;
  return (
    <Tip id={id} open={tip.open} onKeep={tip.keep} onHide={tip.hide}>
      <button
        type="button"
        data-ref-term
        className={cn(linkClass, className)}
        onMouseEnter={() => tip.show(300)}
        onMouseLeave={tip.hide}
        onFocus={() => tip.show(0)}
        onBlur={tip.hide}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openEntry(id);
        }}
      >
        {children}
      </button>
    </Tip>
  );
}

/**
 * Hover card for a control that already has its own click, such as the condition
 * picker and the Hold button. The card's link opens the entry.
 */
export function RulesHint({ id, children }: { id: string; children: ReactNode }) {
  const { tooltips } = useReference();
  const tip = useTip();
  if (!tooltips || !getEntry(id)) return children;
  return (
    <Tip id={id} open={tip.open} onKeep={tip.keep} onHide={tip.hide}>
      <span
        className="inline-flex"
        onMouseEnter={() => tip.show(300)}
        onMouseLeave={tip.hide}
        onFocus={() => tip.show(0)}
        onBlur={tip.hide}
      >
        {children}
      </span>
    </Tip>
  );
}
