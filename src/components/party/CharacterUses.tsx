import { useState } from "react";
import {
  addTemporarySlot,
  grantSlots,
  setResourceCurrent,
  setSlotCurrent,
  slotsInOrder,
  type Character,
  type SlotKind,
} from "@/lib/characters";
import { uid } from "@/lib/encounters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pips } from "./Pips";

function slotLabel(kind: SlotKind, level: number, temporary?: boolean) {
  if (kind === "pact") return temporary ? `Pact ${level} temp` : `Pact ${level}`;
  return temporary ? `${level} temp` : String(level);
}

export function CharacterUses({
  character,
  onChange,
}: {
  character: Character;
  onChange: (next: Character) => void;
}) {
  const [level, setLevel] = useState("1");
  const [count, setCount] = useState("1");
  const add = (kind: SlotKind) =>
    onChange(grantSlots(character, kind, Number(level), Number(count)));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {character.slots.length === 0 && character.resources.length === 0 && (
          <p className="text-sm text-muted-foreground">No slots or limited uses on the sheet.</p>
        )}
        {slotsInOrder(character.slots).map((s) => (
          <Pips
            key={s.id}
            label={slotLabel(s.kind, s.level, s.temporary)}
            max={s.max}
            current={s.current}
            onChange={(n) => onChange(setSlotCurrent(character, s.id, n))}
          />
        ))}
        {character.resources.map((r) => (
          <Pips
            key={r.id}
            label={r.name || "Use"}
            max={r.max}
            current={r.current}
            onChange={(n) => onChange(setResourceCurrent(character, r.id, n))}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          <span className="label-caps">Level</span>
          <Input
            className="h-8 w-16 font-mono"
            inputMode="numeric"
            aria-label="Slot level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="label-caps">Count</span>
          <Input
            className="h-8 w-16 font-mono"
            inputMode="numeric"
            aria-label="Slot count"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => add("spell")}>
          Spell slots
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("pact")}>
          Pact slots
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(addTemporarySlot(character, Number(level)))}
        >
          + temporary slot
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() =>
          onChange({
            ...character,
            resources: [
              ...character.resources,
              { id: uid(), name: "New use", max: 1, current: 1, reset: "long" },
            ],
          })
        }
      >
        Add a limited use
      </Button>
    </div>
  );
}
