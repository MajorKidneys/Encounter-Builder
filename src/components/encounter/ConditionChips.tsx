import { useState } from "react";
import { X } from "lucide-react";
import { type Condition, uid } from "@/lib/encounters";
import { CONDITIONS, CONDITION_RULES } from "@/lib/turns";
import { conditionEntryId } from "@/lib/reference";
import { RefTerm, RulesHint } from "@/components/reference/RefTerm";
import { useReference } from "@/components/reference/ReferenceLayer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex h-6 items-center gap-1 rounded-full border border-transparent pl-2.5 pr-1 text-xs font-medium";

/** Condition chips for one copy, with the picker that adds them. */
export function ConditionChips({
  name,
  conditions,
  immune = [],
  onChange,
}: {
  name: string;
  conditions: Condition[];
  immune?: string[];
  onChange: (next: Condition[]) => void;
}) {
  const { tooltips } = useReference();
  const remove = (id: string) => onChange(conditions.filter((k) => k.id !== id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conditions.map((k) => {
        const tip = `${k.name}: ${CONDITION_RULES[k.name] ?? ""}${k.note ? ` (${k.note})` : ""}`;
        if (k.expired) {
          return (
            <span
              key={k.id}
              title={tooltips ? undefined : tip}
              className={cn(chip, "border-dashed border-primary pr-0.5 text-wine-ink")}
            >
              {k.name} ended
              <button
                className="h-[18px] rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
                onClick={() => remove(k.id)}
              >
                Remove
              </button>
              <button
                className="h-[18px] rounded-full px-2 text-[11px] font-semibold"
                onClick={() =>
                  onChange(
                    conditions.map((x) =>
                      x.id === k.id ? { ...x, expired: false, rounds: null } : x,
                    ),
                  )
                }
              >
                Keep
              </button>
            </span>
          );
        }
        const conc = k.name === "Concentrating";
        const exh = k.name === "Exhaustion";
        return (
          <span
            key={k.id}
            title={tooltips ? undefined : exh ? `${tip} Click the dots to change the level.` : tip}
            className={cn(
              chip,
              conc
                ? "border-gold/60 bg-gold/20 text-gold-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <RefTerm id={conditionEntryId(k.name)}>{k.name}</RefTerm>
            {k.note && <span className="font-mono text-[10.5px] opacity-80">· {k.note}</span>}
            {exh && (
              <button
                className="flex gap-0.5 px-0.5"
                aria-label={`Exhaustion level ${k.level ?? 1}, raise level`}
                onClick={() =>
                  onChange(
                    conditions.map((x) =>
                      x.id === k.id ? { ...x, level: ((x.level ?? 1) % 6) + 1 } : x,
                    ),
                  )
                }
              >
                {[1, 2, 3, 4, 5, 6].map((l) => (
                  <i
                    key={l}
                    className={cn(
                      "h-[5px] w-[5px] rounded-full",
                      l <= (k.level ?? 1) ? "bg-current" : "bg-current/25",
                    )}
                  />
                ))}
              </button>
            )}
            {typeof k.rounds === "number" && (
              <span className="font-mono text-[10.5px] opacity-80">{k.rounds} rd</span>
            )}
            <button
              className="grid h-[18px] w-[18px] place-items-center rounded-full opacity-60 hover:bg-foreground/10 hover:opacity-100"
              aria-label={`Remove ${k.name}`}
              onClick={() => remove(k.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <ConditionPicker name={name} conditions={conditions} immune={immune} onChange={onChange} />
    </div>
  );
}

function ConditionPicker({
  name,
  conditions,
  immune,
  onChange,
}: {
  name: string;
  conditions: Condition[];
  immune: string[];
  onChange: (next: Condition[]) => void;
}) {
  const { tooltips } = useReference();
  const [rounds, setRounds] = useState("");
  const [note, setNote] = useState("");
  const has = new Set(conditions.map((k) => k.name));
  const toggle = (n: string) => {
    if (has.has(n)) return onChange(conditions.filter((k) => k.name !== n));
    const k: Condition = { id: uid(), name: n };
    if (n === "Exhaustion") k.level = 1;
    else if (rounds && n !== "Concentrating") k.rounds = Number(rounds);
    if (note.trim() && (n === "Concentrating" || !rounds)) k.note = note.trim();
    onChange([...conditions, k]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            chip,
            "border-dashed border-input px-2.5 text-muted-foreground hover:border-primary hover:text-wine-ink",
          )}
        >
          + Condition
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] space-y-3">
        <p className="label-caps">Conditions on {name}</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((n) => {
            const isImmune = immune.includes(n);
            const button = (
              <button
                key={n}
                disabled={isImmune}
                aria-pressed={has.has(n)}
                title={isImmune ? `${name} is immune` : tooltips ? undefined : CONDITION_RULES[n]}
                onClick={() => toggle(n)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs",
                  has.has(n)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:border-primary",
                  n === "Concentrating" && !has.has(n) && "border-gold/70",
                  isImmune && "cursor-not-allowed line-through opacity-45",
                  tooltips && !isImmune && "underline decoration-dotted underline-offset-2",
                )}
              >
                {n}
              </button>
            );
            return isImmune ? (
              button
            ) : (
              <RulesHint key={n} id={conditionEntryId(n)}>
                {button}
              </RulesHint>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <label className="grid gap-1">
            New conditions last
            <select
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-foreground"
            >
              <option value="">until removed</option>
              <option value="1">1 round</option>
              <option value="2">2 rounds</option>
              <option value="3">3 rounds</option>
              <option value="10">10 rounds (1 min)</option>
            </select>
          </label>
          <label className="grid gap-1">
            Source or spell (optional)
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Hold Person"
              className="h-8 text-foreground"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Timed conditions last through that many of {name}'s turns, then ask to be removed.
        </p>
      </PopoverContent>
    </Popover>
  );
}
