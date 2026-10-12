import { pipValue } from "@/lib/characters";
import { cn } from "@/lib/utils";

/** One group of pips, the same idea as the exhaustion dots. */
export function Pips({
  label,
  max,
  current,
  onChange,
}: {
  label: string;
  max: number;
  current: number;
  onChange: (next: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
      <span>{label}</span>
      <span className="inline-flex gap-0.5">
        {Array.from({ length: Math.max(0, max) }, (_, i) => (
          <button
            key={i}
            type="button"
            className="grid h-4 w-3 place-items-center"
            aria-label={`${label}, ${i < current ? "available" : "spent"}`}
            onClick={() => onChange(pipValue(i, current))}
          >
            <i
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                i < current ? "bg-current" : "bg-current/25",
              )}
            />
          </button>
        ))}
      </span>
    </span>
  );
}
