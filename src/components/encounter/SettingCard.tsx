import { useEffect, useState } from "react";
import { firstLine } from "@/lib/prep";
import { NoteCard, useAutoGrow, useCardOpen } from "./NoteCard";

/** The read-aloud scene. Reads as paragraphs; click or Edit to change it. */
export function SettingCard({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [open, setOpen] = useCardOpen("setting");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useAutoGrow(draft);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const empty = !value.trim();
  const showField = editing || empty;
  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <NoteCard
      label="Setting"
      title="Setting"
      hint="read aloud"
      summary={firstLine(value)}
      open={open}
      onOpenChange={setOpen}
      editing={editing}
      onEdit={
        empty
          ? undefined
          : () => {
              setOpen(true);
              setEditing(true);
              requestAnimationFrame(() => ref.current?.focus());
            }
      }
    >
      {showField ? (
        <textarea
          ref={ref}
          aria-label="Setting"
          value={draft}
          rows={3}
          autoFocus={editing}
          placeholder="Where this happens, and what the party sees when they arrive."
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className="block max-h-[60vh] min-h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      ) : (
        <p
          role="button"
          tabIndex={0}
          title="Click to edit"
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
          className="max-w-[68ch] cursor-text whitespace-pre-line text-[17px] leading-relaxed"
        >
          {value}
        </p>
      )}
    </NoteCard>
  );
}
