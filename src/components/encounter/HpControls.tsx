import { useState } from "react";
import { RefTerm } from "@/components/reference/RefTerm";
import { cn } from "@/lib/utils";

const HEART =
  "M8 13.5S2 9.8 2 5.8C2 4 3.4 2.6 5.1 2.6c1.2 0 2.3.7 2.9 1.7.6-1 1.7-1.7 2.9-1.7C12.6 2.6 14 4 14 5.8c0 4-6 7.7-6 7.7z";

/** Current / max with a bar that moves teal → gold below half → red below a quarter. */
export function HpMeter({ hp, max }: { hp: number; max: number }) {
  const p = max > 0 ? hp / max : 0;
  const state = hp <= 0 ? "Down" : p < 0.25 ? "Critical" : p < 0.5 ? "Bloodied" : "";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline gap-1.5 font-mono text-[13px] text-muted-foreground tabular">
        <b className="text-[17px] font-semibold text-foreground">{hp}</b>/ {max}
        {state &&
          (state === "Down" ? (
            <RefTerm
              id="dropping-to-0-hp"
              className="ml-auto font-sans text-[11px] font-semibold text-destructive"
            >
              {state}
            </RefTerm>
          ) : (
            <span
              className={cn(
                "ml-auto font-sans text-[11px] font-semibold",
                state === "Bloodied" ? "text-gold-foreground" : "text-destructive",
              )}
            >
              {state}
            </span>
          ))}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <i
          className={cn(
            "block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
            p < 0.25 ? "bg-destructive" : p < 0.5 ? "bg-gold" : "bg-teal",
          )}
          style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** One amount box: Enter or the broken heart applies damage; "+5" or the heart heals. */
export function DamageHeal({
  label,
  onApply,
}: {
  label: string;
  onApply: (delta: number) => void;
}) {
  const [v, setV] = useState("");
  const apply = (heal: boolean) => {
    const n = Math.abs(parseInt(v, 10));
    if (!n) return;
    onApply(heal ? -n : n);
    setV("");
  };
  return (
    <div className="inline-flex h-8 overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="0"
        inputMode="numeric"
        aria-label={`Damage or healing for ${label}`}
        title="Enter applies damage. Type +5 and Enter to heal."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply(v.trim().startsWith("+"));
          }
        }}
        className="w-12 bg-transparent text-center font-mono text-[13px] tabular outline-none"
      />
      <button
        onClick={() => apply(false)}
        title="Damage (Enter)"
        aria-label={`Damage ${label}`}
        className="grid w-8 place-items-center border-l border-border text-destructive hover:bg-destructive/10"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d={HEART} />
          <path d="M8 4.3L6.9 7l2 1.5-1.1 2.8" />
        </svg>
      </button>
      <button
        onClick={() => apply(true)}
        title="Heal"
        aria-label={`Heal ${label}`}
        className="grid w-8 place-items-center border-l border-border text-teal-foreground hover:bg-teal/15"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4"
          fill="currentColor"
          fillOpacity=".25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d={HEART} />
        </svg>
      </button>
    </div>
  );
}
