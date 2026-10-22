import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Whether each card is open is a viewing preference, kept apart from encounter data.
const KEY = "dm-encounter-cards-v1";
type CardKind = "setting" | "prep";

function readCards(): Partial<Record<CardKind, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<CardKind, boolean>>;
  } catch {
    return {};
  }
}

/** Open by default; the choice sticks per card type. */
export function useCardOpen(kind: CardKind) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const saved = readCards()[kind];
    if (typeof saved === "boolean") setOpen(saved);
  }, [kind]);
  const set = (value: boolean) => {
    setOpen(value);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readCards(), [kind]: value }));
    } catch {
      /* storage may be unavailable */
    }
  };
  return [open, set] as const;
}

/** Grows with its text so long read-aloud passages never need an inner scrollbar. */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return ref;
}

/** One white card for Setting and for Prep notes: a header that folds it, then the body. */
export function NoteCard({
  label,
  title,
  hint,
  chips,
  summary,
  open,
  onOpenChange,
  onEdit,
  editing,
  children,
}: {
  label: string;
  title: string;
  hint: string;
  chips?: ReactNode;
  summary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (() => void) | undefined;
  editing?: boolean;
  children: ReactNode;
}) {
  const bodyId = `${label.toLowerCase().replace(/\W+/g, "-")}-body`;
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-[14px] border bg-card",
        editing
          ? "border-primary/60 shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]"
          : "border-border",
      )}
    >
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] px-4 py-3 text-left"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="label-caps shrink-0">{title}</span>
          <span className="shrink-0 text-[11.5px] text-muted-foreground">{hint}</span>
          {chips}
          {!open && summary && (
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">{summary}</span>
          )}
        </button>
        {onEdit && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit ${title.toLowerCase()}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      {open && (
        <div id={bodyId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
