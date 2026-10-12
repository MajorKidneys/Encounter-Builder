import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Which drawer sections are open is a viewing preference, so it's remembered separately
// from encounter data and opening or closing a section never writes to an encounter.
const KEY = "dm-drawer-sections-v1";
let memory: Record<string, boolean> | null = null;
function read(): Record<string, boolean> {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    memory = {};
  }
  return memory;
}
export function useSectionOpen(id: string, initial: boolean) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    const saved = read()[id];
    if (typeof saved === "boolean") setOpen(saved);
  }, [id]);
  const set = (v: boolean) => {
    setOpen(v);
    const next = { ...read(), [id]: v };
    memory = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  };
  return [open, set] as const;
}

/** A drawer section with a chevron header; `actions` sit on the right of the header. */
export function Section({
  id,
  title,
  initial = true,
  count,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  initial?: boolean;
  count?: number | string | undefined;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useSectionOpen(id, initial);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("border-t border-border pt-2", className)}
    >
      <div className="flex min-h-8 items-center gap-2">
        <CollapsibleTrigger
          className="flex flex-1 items-center gap-1.5 rounded-md py-1 text-left"
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
          />
          <span className="label-caps">{title}</span>
          {count !== undefined && count !== "" && (
            <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
          )}
        </CollapsibleTrigger>
        {actions}
      </div>
      <CollapsibleContent className="pb-3 pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
