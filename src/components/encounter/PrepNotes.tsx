import type { Encounter, LootItem } from "@/lib/encounters";
import { beatLabel, beatsForRound, hasPrep } from "@/lib/prep";
import { isLive } from "@/lib/turns";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** What the adventure doc said to remember during this fight: where it is, how they fight, when to run. */
export function PrepNotes({
  encounter,
  update,
}: {
  encounter: Encounter;
  update: (fn: (e: Encounter) => Encounter) => void;
}) {
  if (!hasPrep(encounter)) return null;
  const live = isLive(encounter);
  const now = live ? beatsForRound(encounter.beats, encounter.round ?? 0) : [];
  const dormant = encounter.status === "dormant";
  const setTaken = (id: string, taken: boolean) =>
    update((e) => ({
      ...e,
      roomLoot: (e.roomLoot ?? []).map((l: LootItem) => (l.id === id ? { ...l, taken } : l)),
    }));

  return (
    <section aria-label="Prep notes" className="mb-4 grid gap-3">
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
      <details open className="rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 text-sm font-semibold">
          Prep notes
          {encounter.location && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal text-secondary-foreground">
              {encounter.location}
            </span>
          )}
          {dormant && (
            <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
              Dormant
            </span>
          )}
          {encounter.session && (
            <span className="text-xs font-normal text-muted-foreground">{encounter.session}</span>
          )}
        </summary>
        <div className="grid gap-3 border-t border-border px-4 py-3 text-sm">
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
      </details>
    </section>
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
