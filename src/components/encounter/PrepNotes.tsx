import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { uid, type Encounter, type LootItem } from "@/lib/encounters";
import {
  applyDraft,
  beatLabel,
  beatsForRound,
  draftErrors,
  draftFromEncounter,
  hasPrep,
  isLongLocation,
  prepSummary,
  type PrepDraft,
} from "@/lib/prep";
import { isLive } from "@/lib/turns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NoteCard, useAutoGrow, useCardOpen } from "./NoteCard";

type FocusTarget = "session" | "tactics" | "morale" | "beat" | "loot" | "trigger" | null;

const PILLS: { label: string; target: Exclude<FocusTarget, null> }[] = [
  { label: "Tactics", target: "tactics" },
  { label: "Morale", target: "morale" },
  { label: "Round beat", target: "beat" },
  { label: "Loot in the room", target: "loot" },
  { label: "Only happens if…", target: "trigger" },
  { label: "Session & location", target: "session" },
];

/** What the adventure doc said to remember during this fight: where it is, how they fight, when to run. */
export function PrepNotes({
  encounter,
  update,
}: {
  encounter: Encounter;
  update: (fn: (e: Encounter) => Encounter) => void;
}) {
  const [open, setOpen] = useCardOpen("prep");
  const [draft, setDraft] = useState<PrepDraft | null>(null);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const live = isLive(encounter);
  const now = live ? beatsForRound(encounter.beats, encounter.round ?? 0) : [];
  const dormant = encounter.status === "dormant";
  const filled = hasPrep(encounter);

  useEffect(() => setDraft(null), [encounter.id]);

  const edit = (target: FocusTarget = null) => {
    const next = draftFromEncounter(encounter);
    if (target === "beat") next.beats.push({ key: uid(), round: "", text: "" });
    if (target === "loot") next.loot.push({ key: uid(), id: null, name: "", detail: "" });
    if (target === "trigger") next.dormant = true;
    setOpen(true);
    setFocus(target);
    setDraft(next);
  };
  const save = () => {
    if (!draft || Object.keys(draftErrors(draft)).length) return;
    update((e) => applyDraft(e, draft));
    setDraft(null);
  };
  const setTaken = (id: string, taken: boolean) =>
    update((e) => ({
      ...e,
      roomLoot: (e.roomLoot ?? []).map((l: LootItem) => (l.id === id ? { ...l, taken } : l)),
    }));

  return (
    <div className="grid gap-3">
      {now.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-primary/40 bg-primary/[0.07] px-4 py-3 text-sm"
        >
          <p className="label-caps text-[10px]">This round</p>
          <ul className="mt-1 space-y-0.5">
            {now.map((b, i) => (
              <li key={i} className="font-medium">
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      <NoteCard
        label="Prep notes"
        title="Prep notes"
        hint={draft ? "DM only · editing" : "DM only"}
        chips={
          <>
            {encounter.session && (
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                {encounter.session}
              </span>
            )}
            {encounter.location && !isLongLocation(encounter.location) && (
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground">
                {encounter.location}
              </span>
            )}
            {dormant && (
              <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
                Dormant
              </span>
            )}
          </>
        }
        summary={prepSummary(encounter)}
        open={open}
        onOpenChange={setOpen}
        editing={draft !== null}
        onEdit={() => edit()}
      >
        {draft ? (
          <PrepForm
            draft={draft}
            setDraft={setDraft}
            focus={focus}
            onSave={save}
            onCancel={() => setDraft(null)}
          />
        ) : !filled ? (
          <div>
            <p className="text-sm text-muted-foreground">
              How they fight, when they run, and what&apos;s lying around. Add only what this
              encounter needs.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PILLS.map((p) => (
                <button
                  key={p.target}
                  type="button"
                  onClick={() => edit(p.target)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-3 py-1 text-[13px] text-muted-foreground hover:border-primary hover:text-wine-ink"
                >
                  <Plus className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <PrepView encounter={encounter} live={live} setTaken={setTaken} />
        )}
      </NoteCard>
    </div>
  );
}

function PrepView({
  encounter,
  live,
  setTaken,
}: {
  encounter: Encounter;
  live: boolean;
  setTaken: (id: string, taken: boolean) => void;
}) {
  const dormant = encounter.status === "dormant";
  return (
    <div className="grid gap-3 text-sm">
      {encounter.location && isLongLocation(encounter.location) && (
        <p className="whitespace-pre-line text-[13px] text-muted-foreground">
          {encounter.location}
        </p>
      )}
      {dormant && (
        <Field label="Only happens if">
          {encounter.trigger || "A trigger isn't written down."}
        </Field>
      )}
      {encounter.tactics && <Field label="Tactics">{encounter.tactics}</Field>}
      {encounter.morale && <Field label="Morale">{encounter.morale}</Field>}
      {!!encounter.beats?.length && (
        <div>
          <p className="label-caps text-[10px]">Round by round</p>
          <ul className="mt-1 space-y-0.5">
            {encounter.beats.map((b, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-2",
                  live &&
                    beatsForRound(encounter.beats, encounter.round ?? 0).includes(b) &&
                    "font-semibold",
                )}
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {beatLabel(b)}
                </span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!encounter.roomLoot?.length && (
        <div>
          <p className="label-caps text-[10px]">Loot in the room</p>
          <ul className="mt-1 space-y-1">
            {encounter.roomLoot.map((l) => (
              <li key={l.id} className="flex items-start gap-2">
                <Checkbox
                  checked={l.taken}
                  aria-label={`Collected ${l.name}`}
                  onCheckedChange={(v) => setTaken(l.id, v === true)}
                  className="mt-0.5"
                />
                <span className={cn(l.taken && "text-muted-foreground line-through")}>
                  {l.name}
                  <LootDetail l={l} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

function GrowField({
  value,
  onChange,
  label,
  field,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  field: string;
  placeholder?: string;
}) {
  const ref = useAutoGrow(value);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      data-field={field}
      rows={2}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="block min-h-16 w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-primary"
    />
  );
}

function PrepForm({
  draft,
  setDraft,
  focus,
  onSave,
  onCancel,
}: {
  draft: PrepDraft;
  setDraft: (d: PrepDraft) => void;
  focus: FocusTarget;
  onSave: () => void;
  onCancel: () => void;
}) {
  const root = useRef<HTMLFormElement>(null);
  const errors = draftErrors(draft);
  const set = (patch: Partial<PrepDraft>) => setDraft({ ...draft, ...patch });

  useEffect(() => {
    const selector =
      focus === "beat"
        ? "[data-field=beat-round]:last-of-type, [data-field=beat-round]"
        : focus === "loot"
          ? "[data-field=loot-name]"
          : focus
            ? `[data-field=${focus}]`
            : "[data-field=session]";
    const nodes = root.current?.querySelectorAll<HTMLElement>(selector);
    (focus === "beat" || focus === "loot" ? nodes?.[nodes.length - 1] : nodes?.[0])?.focus();
    // Focus once, when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      ref={root}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="grid gap-3.5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="label-caps text-[10px]">Session</span>
          <input
            data-field="session"
            aria-label="Session"
            value={draft.session}
            onChange={(e) => set({ session: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1">
          <span className="label-caps text-[10px]">Location key</span>
          <input
            data-field="location"
            aria-label="Location key"
            value={draft.location}
            placeholder="Short, like U3 or G1 Conservatory"
            onChange={(e) => set({ location: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="label-caps text-[10px]">Tactics</span>
        <GrowField
          label="Tactics"
          field="tactics"
          value={draft.tactics}
          onChange={(v) => set({ tactics: v })}
        />
      </label>
      <label className="grid gap-1">
        <span className="label-caps text-[10px]">Morale</span>
        <GrowField
          label="Morale"
          field="morale"
          value={draft.morale}
          onChange={(v) => set({ morale: v })}
        />
      </label>

      <div className="grid gap-1.5">
        <span className="label-caps text-[10px]">Round by round</span>
        {draft.beats.map((b) => (
          <div key={b.key}>
            <div className="flex items-center gap-2">
              <input
                data-field="beat-round"
                aria-label="Round"
                aria-invalid={errors[b.key] ? true : undefined}
                value={b.round}
                placeholder="2 or 6+"
                onChange={(e) =>
                  set({
                    beats: draft.beats.map((x) =>
                      x.key === b.key ? { ...x, round: e.target.value } : x,
                    ),
                  })
                }
                className={cn(inputClass, "w-24 font-mono", errors[b.key] && "border-destructive")}
              />
              <input
                aria-label="What happens that round"
                value={b.text}
                placeholder="What happens that round"
                onChange={(e) =>
                  set({
                    beats: draft.beats.map((x) =>
                      x.key === b.key ? { ...x, text: e.target.value } : x,
                    ),
                  })
                }
                className={inputClass}
              />
              <button
                type="button"
                aria-label="Remove beat"
                onClick={() => set({ beats: draft.beats.filter((x) => x.key !== b.key) })}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {errors[b.key] && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors[b.key]}
              </p>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start text-wine-ink"
          onClick={() => set({ beats: [...draft.beats, { key: uid(), round: "", text: "" }] })}
        >
          <Plus /> Add beat
        </Button>
      </div>

      <div className="grid gap-1.5">
        <span className="label-caps text-[10px]">Loot in the room</span>
        {draft.loot.map((l) => (
          <div key={l.key} className="flex items-center gap-2">
            <input
              data-field="loot-name"
              aria-label="Loot name"
              value={l.name}
              placeholder="Name"
              onChange={(e) =>
                set({
                  loot: draft.loot.map((x) =>
                    x.key === l.key ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
              className={inputClass}
            />
            <input
              aria-label="Loot detail"
              value={l.detail}
              placeholder="Detail, like how it is earned"
              onChange={(e) =>
                set({
                  loot: draft.loot.map((x) =>
                    x.key === l.key ? { ...x, detail: e.target.value } : x,
                  ),
                })
              }
              className={inputClass}
            />
            <button
              type="button"
              aria-label="Remove loot"
              onClick={() => set({ loot: draft.loot.filter((x) => x.key !== l.key) })}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start text-wine-ink"
          onClick={() =>
            set({ loot: [...draft.loot, { key: uid(), id: null, name: "", detail: "" }] })
          }
        >
          <Plus /> Add loot
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.dormant}
            onCheckedChange={(v) => set({ dormant: v === true })}
            aria-label="Only happens if"
          />
          Only happens if…
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={Object.keys(errors).length > 0}>
            Save notes
          </Button>
        </div>
      </div>
      {draft.dormant && (
        <label className="grid gap-1">
          <span className="label-caps text-[10px]">Only happens if</span>
          <GrowField
            label="Trigger"
            field="trigger"
            value={draft.trigger}
            placeholder="What has to happen first"
            onChange={(v) => set({ trigger: v })}
          />
        </label>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps text-[10px]">{label}</p>
      <p className="mt-0.5 whitespace-pre-line">{children}</p>
    </div>
  );
}

/** Value, condition and harvest check for a loot line, shared with the creature drawer. */
export function LootDetail({ l }: { l: LootItem }) {
  const bits = [
    l.value,
    l.condition,
    l.harvest ? `${l.harvest.skill} DC ${l.harvest.dc} to harvest` : undefined,
  ].filter(Boolean);
  if (!bits.length) return null;
  return <span className="block text-xs text-muted-foreground">{bits.join(" · ")}</span>;
}
