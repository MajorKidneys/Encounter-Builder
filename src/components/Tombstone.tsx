import { cn } from "@/lib/utils";

/** Small grave marker for a dead player, NPC, or monster. */
export function Tombstone({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("h-3.5 w-3.5", className)}
      fill="currentColor"
    >
      <path d="M8 1.25A4.25 4.25 0 0 0 3.75 5.5V13h1.15V5.5a3.1 3.1 0 0 1 6.2 0V13h1.15V5.5A4.25 4.25 0 0 0 8 1.25z" />
      <path d="M2.75 13.15h10.5V14.5H2.75z" />
    </svg>
  );
}
