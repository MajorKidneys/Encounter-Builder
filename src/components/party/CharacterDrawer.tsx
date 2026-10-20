import { X } from "lucide-react";
import {
  identity,
  longRest,
  shortRest,
  type Character,
  type CharacterAttack,
  type CharacterGear,
  type CharacterResource,
} from "@/lib/characters";
import { uid } from "@/lib/encounters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { drawerPanelClass } from "@/components/Stage";
import { Tombstone } from "@/components/Tombstone";
import { CharacterUses } from "./CharacterUses";

const ABS = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];
const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

export function CharacterDrawer({
  character,
  onChange,
  onClose,
  onDelete,
}: {
  character: Character;
  onChange: (next: Character) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<Character>) => onChange({ ...character, ...patch });
  const setAttack = (id: string, patch: Partial<CharacterAttack>) =>
    set({ attacks: character.attacks.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const setGear = (id: string, patch: Partial<CharacterGear>) =>
    set({ gear: character.gear.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const setResource = (id: string, patch: Partial<CharacterResource>) =>
    set({ resources: character.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <aside data-drawer-panel aria-label={`${character.name} details`} className={drawerPanelClass}>
      <div className="grid gap-3 border-b border-border px-5 pb-3.5 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="label-caps">{character.role === "npc" ? "NPC" : "Player character"}</p>
            <input
              aria-label="Name"
              value={character.name}
              onChange={(e) => set({ name: e.target.value })}
              className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 font-display text-[26px] font-bold leading-tight outline-none hover:border-input focus:border-primary focus:bg-card"
            />
            <p className="mt-1 text-[12.5px] text-muted-foreground">{identity(character)}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={character.dead ? "secondary" : "outline"}
            size="sm"
            aria-pressed={Boolean(character.dead)}
            onClick={() => set({ dead: !character.dead })}
          >
            <Tombstone />
            {character.dead ? "Dead" : "Mark dead"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(shortRest(character))}
          >
            Short rest
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(longRest(character))}
          >
            Long rest
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Delete ${character.name}?`)) onDelete();
            }}
          >
            Delete
          </Button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          {character.role === "pc"
            ? "Hit points are tracked by the player. Max HP here is only a reference."
            : "In a fight, you track this NPC's hit points from the maximum below."}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="label-caps">Race</span>
            <Input
              aria-label="Race"
              value={character.race}
              onChange={(e) => set({ race: e.target.value })}
              className="h-8"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Class and level</span>
            <Input
              aria-label="Class and level"
              value={character.classes}
              placeholder="Cleric 5"
              onChange={(e) => set({ classes: e.target.value })}
              className="h-8"
            />
          </label>
        </div>

        <h2 className="label-caps mb-2 mt-5">Slots and uses</h2>
        <CharacterUses character={character} onChange={onChange} />
        <div className="mt-3 grid gap-2">
          {character.resources.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Use name"
                value={r.name}
                onChange={(e) => setResource(r.id, { name: e.target.value })}
                className="h-8 w-36"
              />
              <Input
                aria-label={`${r.name || "Use"} maximum`}
                value={r.max}
                onChange={(e) =>
                  setResource(r.id, {
                    max: Math.max(0, Number(e.target.value) || 0),
                    current: Math.min(r.current, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="h-8 w-16 font-mono"
              />
              <select
                aria-label={`${r.name || "Use"} rest`}
                value={r.reset ?? ""}
                className="h-8 rounded-md border border-input bg-card px-2 text-sm"
                onChange={(e) =>
                  setResource(r.id, {
                    reset: e.target.value === "" ? null : (e.target.value as "short" | "long"),
                  })
                }
              >
                <option value="short">Short rest</option>
                <option value="long">Long rest</option>
                <option value="">Manual only</option>
              </select>
            </div>
          ))}
        </div>

        <h2 className="label-caps mb-2 mt-5">Combat</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="label-caps">AC</span>
            <Input
              aria-label="Armor class"
              value={character.ac ?? ""}
              onChange={(e) => set({ ac: num(e.target.value) })}
              className="h-8 font-mono"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">AC note</span>
            <Input
              aria-label="Armor note"
              value={character.acNote}
              onChange={(e) => set({ acNote: e.target.value })}
              className="h-8"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Max HP</span>
            <Input
              aria-label="Max HP"
              value={character.maxHp ?? ""}
              onChange={(e) => set({ maxHp: num(e.target.value) })}
              className="h-8 font-mono"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Speed</span>
            <Input
              aria-label="Speed"
              value={character.speed}
              onChange={(e) => set({ speed: e.target.value })}
              className="h-8"
            />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {ABS.map((label, i) => (
            <label key={label} className="grid gap-1">
              <span className="label-caps">{label}</span>
              <Input
                aria-label={label}
                value={character.abilities[i] ?? ""}
                onChange={(e) => {
                  const abilities = character.abilities.slice();
                  abilities[i] = num(e.target.value);
                  set({ abilities });
                }}
                className="h-8 px-1 text-center font-mono"
              />
            </label>
          ))}
        </div>
        <label className="mt-2 grid gap-1">
          <span className="label-caps">Saves</span>
          <Input
            aria-label="Saves"
            value={character.saves}
            placeholder="Wis +7, Con +4"
            onChange={(e) => set({ saves: e.target.value })}
            className="h-8"
          />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="label-caps">Passive Perception</span>
            <Input
              aria-label="Passive Perception"
              value={character.passive ?? ""}
              onChange={(e) => set({ passive: num(e.target.value) })}
              className="h-8 font-mono"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Senses</span>
            <Input
              aria-label="Senses"
              value={character.senses}
              onChange={(e) => set({ senses: e.target.value })}
              className="h-8"
            />
          </label>
        </div>

        <h2 className="label-caps mb-2 mt-5">Attacks</h2>
        <div className="grid gap-2">
          {character.attacks.map((a) => (
            <div key={a.id} className="grid grid-cols-[1fr_5rem_1fr] gap-2">
              <Input
                aria-label="Attack name"
                value={a.name}
                onChange={(e) => setAttack(a.id, { name: e.target.value })}
                className="h-8"
              />
              <Input
                aria-label="Attack bonus"
                value={a.attack}
                onChange={(e) => setAttack(a.id, { attack: e.target.value })}
                className="h-8 font-mono"
              />
              <Input
                aria-label="Damage"
                value={a.damage}
                onChange={(e) => setAttack(a.id, { damage: e.target.value })}
                className="h-8"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              set({
                attacks: [...character.attacks, { id: uid(), name: "", attack: "", damage: "" }],
              })
            }
          >
            Add attack
          </Button>
        </div>

        <h2 className="label-caps mb-2 mt-5">Spells</h2>
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1">
            <span className="label-caps">Ability</span>
            <Input
              aria-label="Spell ability"
              value={character.spellAbility}
              onChange={(e) => set({ spellAbility: e.target.value })}
              className="h-8"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Save DC</span>
            <Input
              aria-label="Spell save DC"
              value={character.spellDc ?? ""}
              onChange={(e) => set({ spellDc: num(e.target.value) })}
              className="h-8 font-mono"
            />
          </label>
          <label className="grid gap-1">
            <span className="label-caps">Attack</span>
            <Input
              aria-label="Spell attack"
              value={character.spellAttack ?? ""}
              onChange={(e) => set({ spellAttack: num(e.target.value) })}
              className="h-8 font-mono"
            />
          </label>
        </div>
        <Textarea
          aria-label="Prepared spells"
          className="mt-2 min-h-20"
          placeholder="One spell name per line"
          value={character.prepared.join("\n")}
          onChange={(e) => set({ prepared: e.target.value.split("\n") })}
        />

        <h2 className="label-caps mb-2 mt-5">Gear</h2>
        <div className="grid gap-2">
          {character.gear.map((g) => (
            <div key={g.id} className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Gear name"
                value={g.name}
                onChange={(e) => setGear(g.id, { name: e.target.value })}
                className="h-8"
              />
              <Input
                aria-label="Gear note"
                value={g.note}
                placeholder="Name only, or AC linked"
                onChange={(e) => setGear(g.id, { note: e.target.value })}
                className="h-8"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => set({ gear: [...character.gear, { id: uid(), name: "", note: "" }] })}
          >
            Add gear
          </Button>
        </div>

        <h2 className="label-caps mb-2 mt-5">Notes</h2>
        <Textarea
          aria-label="Notes"
          value={character.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="min-h-64"
        />
      </div>
    </aside>
  );
}
