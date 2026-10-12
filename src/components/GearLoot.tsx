import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Combatant, LootItem } from '@/lib/encounters';
import { uid } from '@/lib/encounters';
import { bonusName, changeLoot, equipment, gearItem, isGenericMagic, loadMagicItems, magicLoot, type MagicItem } from '@/lib/equipment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const sel = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

function BaseSelect({ value, onChange, label, allowNone }: { value: string; onChange: (v: string) => void; label: string; allowNone?: boolean }) {
  return <select aria-label={label} value={value} className={cn(sel, 'min-w-0 flex-1')} onChange={e => onChange(e.target.value)}>
    {allowNone && <option value="">No weapon/armor stats</option>}
    {['weapon', 'armor'].map(k => <optgroup key={k} label={k === 'weapon' ? 'Weapons' : 'Armor'}>{equipment.filter(e => e.kind === k).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>)}
  </select>;
}
function BonusSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return <select aria-label={label} value={value} className={cn(sel, 'w-16')} onChange={e => onChange(Number(e.target.value))}>
    {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n ? `+${n}` : '+0'}</option>)}
  </select>;
}

export function GearLoot({ c, update }: { c: Combatant; update: (fn: (c: Combatant) => Combatant) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('auto');
  const [bonus, setBonus] = useState(0);
  const [base, setBase] = useState('');
  const [desc, setDesc] = useState('');
  const [magic, setMagic] = useState<MagicItem[]>([]);
  useEffect(() => { if (kind === 'magic' && !magic.length) loadMagicItems().then(setMagic); }, [kind, magic.length]);
  const reset = () => { setName(''); setBonus(0); setBase(''); setDesc(''); };
  const magicMatch = kind === 'magic' ? magic.find(m => m.name.toLowerCase() === name.trim().toLowerCase()) : undefined;

  const add = () => {
    if (!name.trim()) return;
    let item: LootItem;
    if (kind === 'magic') {
      if (!magicMatch) return;
      item = magicLoot(magicMatch);
    } else if (kind === 'homebrew') {
      item = { id: uid(), name: name.trim(), taken: false, homebrew: true, ...(desc.trim() ? { desc: desc.trim() } : {}), ...(base ? { equipmentId: base, ...(bonus ? { bonus } : {}) } : {}) };
    } else {
      item = gearItem(name.trim());
      if (kind === 'other') delete item.equipmentId;
      if (item.equipmentId && bonus) { item.bonus = bonus; item.name = bonusName(item.name, bonus); }
    }
    update(x => changeLoot(x, [...x.loot, item]));
    reset();
  };
  const patch = (id: string, fn: (l: LootItem) => LootItem, dropAttack = false) => update(x => changeLoot(
    dropAttack ? { ...x, stats: x.stats ? { ...x.stats, actions: x.stats.actions.filter(a => a.lootId !== id) } : undefined } : x,
    x.loot.map(y => y.id === id ? fn(y) : y)));
  const plainName = (l: LootItem) => !l.homebrew && (!l.magicId || isGenericMagic({ name: l.name.replace(/^.*? (\+\d)$/, 'Weapon, $1') }));
  const showsBonus = kind === 'weapon' || kind === 'armor' || (kind === 'homebrew' && !!base);

  return <section>
    {/* Heading comes from the drawer section. */}
    <div className="rounded-md border border-border bg-card">
      {c.loot.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No items.</p>}
      {c.loot.map(l => {
        const gear = equipment.find(e => e.id === l.equipmentId);
        const tag = l.magicId ? 'Magic' : l.homebrew ? 'Homebrew' : null;
        return <div key={l.id} className="border-b border-border px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Checkbox checked={l.taken} aria-label={`Collected ${l.name}`} title="Collected (removed from creature)" onCheckedChange={v => update(x => changeLoot(x, x.loot.map(y => y.id === l.id ? { ...y, taken: !!v } : y)))} />
            <span className={cn('min-w-0 flex-1 break-words text-sm', l.taken && 'text-muted-foreground line-through')}>{l.name}</span>
            {l.native && <span className="text-xs font-semibold text-muted-foreground">Native</span>}
            {tag && <span className="rounded bg-accent px-1.5 text-xs font-semibold text-accent-foreground">{tag}</span>}
            <span className="text-xs text-muted-foreground">{gear?.kind ?? 'Item'}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Remove ${l.name}`} onClick={() => update(x => changeLoot(x, x.loot.filter(y => y.id !== l.id)))}><X className="h-4 w-4" /></Button>
          </div>
          {(gear || l.homebrew || l.magicId) && <div className="mt-1 flex gap-2">
            <BaseSelect label={`Equipment for ${l.name}`} value={gear?.id ?? ''} allowNone={!!(l.homebrew || l.magicId)} onChange={v => {
              const selected = equipment.find(e => e.id === v);
              patch(l.id, y => {
                const { equipmentId: _e, ...rest } = y;
                if (!selected) return { ...rest, native: false, nativeAction: undefined };
                return { ...rest, name: plainName(y) ? bonusName(selected.name, y.bonus ?? 0) : y.name, equipmentId: selected.id, native: false, nativeAction: undefined };
              }, true);
            }} />
            {gear && <BonusSelect label={`Magic bonus for ${l.name}`} value={l.bonus ?? 0} onChange={b => patch(l.id, y => ({ ...y, bonus: b, name: plainName(y) && !y.native ? bonusName(gear.name, b) : y.name }))} />}
          </div>}
          {(l.acBonus || l.str) && <p className="mt-1 text-xs text-muted-foreground">{l.acBonus ? `+${l.acBonus} AC` : ''}{l.acBonus && l.str ? ' · ' : ''}{l.str ? `Strength becomes ${l.str}` : ''}</p>}
          {l.homebrew ? <Textarea aria-label={`Description for ${l.name}`} placeholder="Homebrew description" value={l.desc ?? ''} onChange={e => update(x => ({ ...x, loot: x.loot.map(y => y.id === l.id ? { ...y, desc: e.target.value } : y) }))} className="mt-1 min-h-14 text-xs" />
            : l.desc && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Description</summary><p className="mt-1 whitespace-pre-line">{l.desc}</p></details>}
        </div>;
      })}
      <div className="space-y-2 border-t border-border p-2">
        <select aria-label="Loot type" value={kind} onChange={e => { setKind(e.target.value); reset(); }} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="auto">Item / equipment</option><option value="weapon">Weapon</option><option value="armor">Armor</option><option value="magic">Magic item (SRD)</option><option value="homebrew">Homebrew item</option><option value="other">Other item</option>
        </select>
        <div className="flex gap-2">
          {kind === 'weapon' || kind === 'armor' ? <select aria-label="Item name" value={name} onChange={e => setName(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Select {kind}</option>
            {equipment.filter(e => e.kind === kind).map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select> : <Input aria-label="Item name" placeholder={kind === 'magic' ? 'Search magic items' : kind === 'homebrew' ? 'Homebrew item name' : 'Item name'} list={kind === 'magic' ? 'magic-options' : kind === 'homebrew' ? undefined : 'equipment-options'} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} className="h-8 min-w-0" />}
          {showsBonus && <BonusSelect label="Magic bonus" value={bonus} onChange={setBonus} />}
          <datalist id="equipment-options">{equipment.filter(e => kind === 'auto' || e.kind === kind).map(e => <option key={e.id} value={e.name} />)}</datalist>
          <datalist id="magic-options">{magic.map(m => <option key={m.id} value={m.name}>{m.rarity}</option>)}</datalist>
          <Button size="sm" variant="outline" onClick={add} disabled={kind === 'magic' && !magicMatch}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {kind === 'magic' && magicMatch && <p className="text-xs text-muted-foreground">{magicMatch.type}</p>}
        {kind === 'homebrew' && <>
          <BaseSelect label="Homebrew base stats" value={base} allowNone onChange={setBase} />
          <Textarea aria-label="Homebrew description" placeholder="What does it do?" value={desc} onChange={e => setDesc(e.target.value)} className="min-h-14 text-xs" />
        </>}
      </div>
    </div>
  </section>;
}
