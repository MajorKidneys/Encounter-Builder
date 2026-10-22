import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_CAMPAIGN_NAME } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

type Props = {
  ready: boolean;
  campaigns: { id: string; name: string }[];
  activeId: string | null;
  name: string;
  /** Set right after a campaign is created, so its name is typed in place. */
  renameArmed: boolean;
  onRenameArmed: () => void;
  onChoose: (id: string) => void;
  onRename: (name: string) => void;
  onCreate: () => void;
  onDelete: () => void;
};

/** The campaign name is the switcher: one control to switch, rename, create, and delete. */
export function CampaignSwitcher({
  ready,
  campaigns,
  activeId,
  name,
  renameArmed,
  onRenameArmed,
  onChoose,
  onRename,
  onCreate,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = name || "Untitled campaign";

  const startEditing = () => {
    setDraft(name);
    setEditing(true);
  };

  useEffect(() => {
    if (renameArmed && ready) {
      startEditing();
      onRenameArmed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameArmed, ready]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [editing]);

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    onRename(draft.replace(/\n/g, " ").trim() || DEFAULT_CAMPAIGN_NAME);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Campaign name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="mt-1 w-full rounded-lg border border-primary bg-card px-2 py-1.5 font-display text-lg font-semibold leading-6 outline-none"
      />
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Campaign: ${shown}`}
          title={shown}
          disabled={!ready}
          className="mt-1 flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-foreground/[0.06] data-[state=open]:bg-foreground/[0.08] disabled:opacity-100"
        >
          <span className="line-clamp-2 min-w-0 break-words font-display text-lg font-semibold leading-6">
            {shown}
          </span>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              menuOpen && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-60"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="label-caps font-normal">Switch campaign</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeId ?? ""} onValueChange={onChoose}>
          {campaigns.map((c) => (
            <DropdownMenuRadioItem
              key={c.id}
              value={c.id}
              className="justify-between gap-2 pl-2 pr-2 data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-wine-ink [&>span:first-child]:hidden"
            >
              <span className="min-w-0 break-words">{c.name || "Untitled campaign"}</span>
              {c.id === activeId && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={startEditing}>
          <Pencil className="mr-2 h-4 w-4" />
          <span className="break-words">Rename “{shown}”</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> New campaign
        </DropdownMenuItem>
        {campaigns.length > 1 && (
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete campaign…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
