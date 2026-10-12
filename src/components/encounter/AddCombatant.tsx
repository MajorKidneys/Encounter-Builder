import { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { type Combatant, makeUnits, uid } from "@/lib/encounters";
import { type LibraryMonster, crLabel, loadLibrary } from "@/lib/monsters";
import { combatantFromLibrary } from "@/lib/equipment";
import { MonsterImportDialog } from "@/components/MonsterImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const field = "grid gap-1";
const label = "label-caps";

/**
 * Name and stats are separate: picking a library monster attaches its stats as a tag,
 * and the name can be changed freely afterwards ("Captain Vex" using Cult Fanatic stats).
 */
export function AddCombatant({ onAdd }: { onAdd: (c: Combatant) => void }) {
  const [lib, setLib] = useState<LibraryMonster[] | null>(null);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<LibraryMonster | null>(null);
  const [qty, setQty] = useState("1");
  const [hp, setHp] = useState("");
  const [init, setInit] = useState("");
  const [isPC, setIsPC] = useState(false);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [dialog, setDialog] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reopen = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  };
  const ensureLib = () => {
    if (!lib) void loadLibrary().then(setLib);
  };
  useEffect(() => {
    setHi(0);
  }, [name]);

  const q = name.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!lib || !q || picked || isPC) return [];
    return lib
      .filter((m) => m.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(!a.name.toLowerCase().startsWith(q)) -
            Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name),
      )
      .slice(0, 7);
  }, [lib, q, picked, isPC]);
  const showList = open && matches.length > 0;

  const attach = (m: LibraryMonster, keepName: boolean) => {
    if (!keepName) setName(m.name);
    setPicked(m);
    setHp(String(m.hp));
    setOpen(false);
    requestAnimationFrame(() => {
      nameRef.current?.focus();
      if (!keepName) nameRef.current?.select();
    });
  };
  const clearStats = () => {
    setPicked(null);
    setHp("");
    nameRef.current?.focus();
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return nameRef.current?.focus();
    const count = Math.max(1, Math.min(20, parseInt(qty, 10) || 1));
    const maxHp = hp === "" ? null : Math.max(0, parseInt(hp, 10) || 0);
    const rolled = parseInt(init, 10);
    const base: Combatant = picked
      ? combatantFromLibrary(picked)
      : {
          id: uid(),
          init: null,
          qty: 1,
          name: n,
          isPC,
          maxHp,
          units: [],
          loot: [],
          currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
          notes: "",
        };
    onAdd({
      ...base,
      name: n,
      isPC,
      init: Number.isNaN(rolled) ? null : rolled,
      qty: count,
      maxHp,
      units: makeUnits(count, maxHp),
    });
    setName("");
    setPicked(null);
    setQty("1");
    setHp("");
    setInit("");
    setIsPC(false);
    nameRef.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-end gap-2.5 rounded-xl border border-dashed border-input p-3.5"
    >
      <div className={cn(field, "min-w-64 flex-1")}>
        <label htmlFor="add-name" className={label}>
          Monster or name
        </label>
        <div className="relative flex">
          <Input
            ref={nameRef}
            id="add-name"
            value={name}
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls="add-suggest"
            placeholder={isPC ? "Player character's name" : "Type a monster, like orc"}
            onFocus={() => {
              ensureLib();
              reopen();
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            onChange={(e) => {
              setName(e.target.value);
              reopen();
            }}
            onKeyDown={(e) => {
              if (!showList) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => (h + 1) % matches.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => (h - 1 + matches.length) % matches.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                attach(matches[hi]!, false);
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="h-9 min-w-0 flex-1 rounded-r-none"
          />
          {picked && (
            <span
              className="inline-flex h-9 items-center gap-1 whitespace-nowrap border border-l-0 border-input bg-teal/15 pl-2.5 pr-1 text-xs font-semibold text-teal-foreground"
              title="Stats come from this monster. Rename freely."
            >
              <span className="font-medium opacity-75">Stats:</span> {picked.name}
              <button
                type="button"
                aria-label="Remove attached stats"
                onClick={clearStats}
                className="grid h-6 w-6 place-items-center rounded opacity-60 hover:bg-foreground/10 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialog(true)}
            className="h-9 rounded-l-none border-l-0 bg-sidebar"
          >
            <Download className="h-4 w-4" /> {picked ? "Change" : "Import stats"}
          </Button>
          {showList && (
            <ul
              id="add-suggest"
              role="listbox"
              className="absolute inset-x-0 bottom-[calc(100%+6px)] z-20 grid gap-px rounded-xl border border-input bg-popover p-1.5 shadow-xl"
            >
              {matches.map((m, i) => (
                <li key={m.id} role="option" aria-selected={i === hi}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      attach(m, false);
                    }}
                    className={cn(
                      "flex w-full items-baseline gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm",
                      i === hi && "bg-accent",
                    )}
                  >
                    <b className="font-semibold">{m.name}</b>
                    {m.source && (
                      <span className="rounded bg-muted px-1 text-[10.5px] text-muted-foreground">
                        Menagerie
                      </span>
                    )}
                    <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      CR {crLabel(m.cr)} · {m.hp} HP · AC {m.ac}
                    </span>
                  </button>
                </li>
              ))}
              <li className="mt-1 border-t border-border px-2.5 pb-1 pt-1.5 text-[11.5px] text-muted-foreground">
                Enter imports stats. Rename it after if you like. Keep typing for a custom name with
                no stats.
              </li>
            </ul>
          )}
        </div>
      </div>
      <div className={field}>
        <label htmlFor="add-qty" className={label}>
          Qty
        </label>
        <Input
          ref={qtyRef}
          id="add-qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          className="h-9 w-14"
        />
      </div>
      <div className={field}>
        <label htmlFor="add-hp" className={label}>
          Max HP
        </label>
        <Input
          id="add-hp"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          placeholder="—"
          inputMode="numeric"
          className="h-9 w-20"
        />
      </div>
      <div className={field}>
        <label htmlFor="add-init" className={label}>
          Init
        </label>
        <Input
          id="add-init"
          value={init}
          onChange={(e) => setInit(e.target.value)}
          placeholder="later"
          inputMode="numeric"
          className="h-9 w-16"
        />
      </div>
      <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-sm">
        <Checkbox
          checked={isPC}
          onCheckedChange={(v) => {
            setIsPC(!!v);
            if (v) setPicked(null);
          }}
        />{" "}
        Player
      </label>
      <Button type="submit" className="h-9">
        Add
      </Button>
      <MonsterImportDialog
        open={dialog}
        onOpenChange={setDialog}
        title="Pick a monster's stats"
        onImport={(m) => {
          const typed = name.trim();
          attach(m, !!typed && (!picked || typed !== picked.name));
          setDialog(false);
        }}
      />
    </form>
  );
}
