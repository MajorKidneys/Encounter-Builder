import data from '@/data/equipment.json';
import nativeArmor from '@/data/native-armor.json';
import type { Combatant, LootItem } from './encounters';
import { makeUnits, uid } from './encounters';
import { blankStats, fromLibrary, type LibraryMonster, type MonsterStats, type Feature } from './monsters';

export type Equipment = { id: string; name: string; kind: string; dice?: string; damageType?: string; finesse?: boolean; ranged?: boolean; thrown?: boolean; ac?: number; dexCap?: number; shield?: boolean };
export type MagicItem = { id: string; name: string; type: string; rarity: string; desc: string; kind?: 'weapon' | 'armor'; base?: string; bonus?: number; acBonus?: number; str?: number };
export const equipment: Equipment[] = data;
let magicCache: MagicItem[] | null = null;
export async function loadMagicItems(): Promise<MagicItem[]> {
  if (!magicCache) magicCache = (await import('@/data/magic-items.json')).default as MagicItem[];
  return magicCache;
}
const normalize = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '').replace(/armou?r$/, '');
export const findEquipment = (v: string) => equipment.find(e => normalize(e.name) === normalize(v));
export const proficiency = (cr: number) => Math.max(2, 2 + Math.floor((Math.max(1, cr) - 1) / 4));
const modifier = (score: number = 10) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n ? `${n > 0 ? '+' : ''}${n}` : '');
export function weaponAttack(e: Equipment, s: MonsterStats, bonus = 0) {
  const str = modifier(s.abilities[0]), dex = modifier(s.abilities[1]);
  const ability = e.finesse ? Math.max(str, dex) : e.ranged && !e.thrown ? dex : str;
  const dmg = ability + bonus;
  return { attack: ability + proficiency(s.cr) + bonus, damage: e.dice ? `${e.dice}${signed(dmg)} ${e.damageType}` : '' };
}
// Adds a magic bonus to a printed damage string like "1d6+2 slashing".
function bumpDamage(d: string, b: number) {
  if (!b) return d;
  return d.replace(/^(\s*\d+d\d+)\s*([+-]\s*\d+)?/, (_, dice: string, m?: string) => `${dice}${signed((m ? Number(m.replace(/\s/g, '')) : 0) + b)}`);
}
function armorBonus(loot: LootItem[], s: MonsterStats) {
  const dex = modifier(s.abilities[1]);
  const active = loot.filter(l => !l.taken);
  const gear = active.map(l => ({ l, e: equipment.find(e => e.id === l.equipmentId) })).filter(x => x.e?.kind === 'armor');
  const body = gear.filter(x => !x.e?.shield);
  const shields = gear.filter(x => x.e?.shield);
  const bodyAc = body.length ? Math.max(...body.map(({ l, e }) => (e?.ac ?? 10) + (l.bonus ?? 0) + (e?.dexCap === 0 ? 0 : Math.min(dex, e?.dexCap ?? 99)))) - (10 + dex) : 0;
  const shieldAc = shields.length ? Math.max(...shields.map(({ l }) => 2 + (l.bonus ?? 0))) : 0;
  const extra = active.reduce((t, l) => t + (l.acBonus ?? 0), 0);
  return bodyAc + shieldAc + extra;
}

// Preserve printed native attacks and explicit DM overrides. Only calculated fields follow later gear/ability changes.
export function syncGear(c: Combatant): Combatant {
  const hasGear = c.loot.some(l => l.equipmentId || l.acBonus || l.str);
  if (!c.stats && !hasGear) return c;
  const s = c.stats ?? { ...blankStats(c.name), hp: c.maxHp ?? 10 };
  const strSet = Math.max(0, ...c.loot.filter(l => !l.taken).map(l => l.str ?? 0));
  const calcStats = strSet > (s.abilities[0] ?? 10) ? { ...s, abilities: [strSet, ...s.abilities.slice(1)] } : s;
  const actions: Feature[] = s.actions.filter(a => !a.lootId || c.loot.some(l => l.id === a.lootId && !l.taken && equipment.find(e => e.id === l.equipmentId)?.kind === 'weapon'));
  for (const l of c.loot.filter(l => !l.taken)) {
    const e = equipment.find(e => e.id === l.equipmentId);
    if (!e || e.kind !== 'weapon') continue;
    const b = l.bonus ?? 0;
    const native = l.nativeAction;
    const calc = native ? { attack: (native.attack ?? 0) + b, damage: bumpDamage(native.damage ?? '', b) } : weaponAttack(e, calcStats, b);
    const i = actions.findIndex(a => a.lootId === l.id);
    const old = actions[i];
    if (old) {
      const prevA = old.calculatedAttack ?? (native ? native.attack : undefined), prevD = old.calculatedDamage ?? (native ? native.damage : undefined);
      actions[i] = { ...old, attack: old.attack === prevA ? calc.attack : old.attack, damage: old.damage === prevD ? calc.damage : old.damage, calculatedAttack: calc.attack, calculatedDamage: calc.damage };
    } else actions.push(native ? { ...native, ...calc, calculatedAttack: calc.attack, calculatedDamage: calc.damage } : { name: l.name, desc: l.desc ?? '', ...calc, lootId: l.id, calculatedAttack: calc.attack, calculatedDamage: calc.damage });
  }
  const nextBonus = armorBonus(c.loot, s);
  return { ...c, gearVersion: 1, gearAc: nextBonus, stats: { ...s, actions, ac: s.ac + nextBonus - (c.gearAc ?? 0) } };
}

export function changeLoot(c: Combatant, loot: LootItem[]): Combatant {
  return syncGear({ ...c, loot });
}
export function gearItem(name: string): LootItem {
  const e = findEquipment(name);
  return { id: uid(), name, taken: false, ...(e ? { equipmentId: e.id } : {}) };
}
export const bonusName = (base: string, b: number) => `${base}${b ? ` +${b}` : ''}`;
function resolveBase(m: MagicItem) {
  if (!m.kind) return undefined;
  const b = (m.base ?? '').toLowerCase();
  return findEquipment(b) ?? equipment.find(e => e.kind === m.kind && b.includes(e.name.toLowerCase()))
    ?? (m.kind === 'weapon' ? findEquipment(b.includes('axe') && !b.includes('sword') ? 'Battleaxe' : 'Longsword') : findEquipment(b.includes('shield') ? 'Shield' : 'Chain mail'));
}
export const isGenericMagic = (m: { name: string }) => /^(Weapon|Armor), \+\d$/.test(m.name);
export function magicLoot(m: MagicItem): LootItem {
  const base = resolveBase(m);
  return {
    id: uid(), taken: false, magicId: m.id, desc: `${m.type}. ${m.desc}`.trim(),
    name: isGenericMagic(m) && base ? bonusName(base.name, m.bonus ?? 0) : m.name,
    ...(base ? { equipmentId: base.id } : {}), ...(m.bonus ? { bonus: m.bonus } : {}), ...(m.acBonus ? { acBonus: m.acBonus } : {}), ...(m.str ? { str: m.str } : {}),
  };
}

export function installNativeGear(c: Combatant, stats: MonsterStats, armorIds: string[] = []): Combatant {
  const loot = c.loot.filter(l => !l.native);
  const actions = stats.actions.map(a => ({ ...a }));
  actions.forEach(a => {
    const e = findEquipment(a.name);
    if (!e || e.kind !== 'weapon') return;
    const l = { ...gearItem(e.name), native: true };
    a.lootId = l.id; a.nativeGear = true;
    loot.push({ ...l, nativeAction: { ...a } });
  });
  armorIds.forEach(id => {
    const e = equipment.find(e => e.id === id);
    if (e) loot.push({ ...gearItem(e.name), native: true });
  });
  // The SRD's printed AC already includes its native armor and shield.
  const withNative = { ...c, loot, stats: { ...stats, actions }, gearVersion: 1, gearAc: armorBonus(loot.filter(l => l.native), stats) };
  return syncGear(withNative);
}

export const nativeArmorFor = (id: string | null | undefined) =>
  id ? (nativeArmor as Record<string, string[]>)[id] ?? [] : [];

// Build a fresh initiative row straight from the library: full stats, native gear, HP at full.
export function combatantFromLibrary(m: LibraryMonster): Combatant {
  const stats = fromLibrary(m);
  return installNativeGear(
    { id: uid(), init: null, qty: 1, name: stats.name, isPC: false, maxHp: stats.hp, units: makeUnits(1, stats.hp), loot: [], currency: { cp: 0, sp: 0, gp: 0, pp: 0 }, notes: '' },
    stats,
    nativeArmorFor(stats.srdId),
  );
}
