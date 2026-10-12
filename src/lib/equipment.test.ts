import { describe, expect, it } from 'vitest';
import { blankStats, fromLibrary, type LibraryMonster } from './monsters';
import { changeLoot, findEquipment, gearItem, installNativeGear, proficiency, syncGear, weaponAttack } from './equipment';
import type { Combatant } from './encounters';
import monsters from '@/data/srd-monsters.json';
import nativeArmor from '@/data/native-armor.json';

function goblin(): Combatant {
  const m = monsters.find(m => m.name === 'Goblin');
  if (!m) throw new Error('Goblin missing');
  return installNativeGear({ id: 'g', name: 'Goblin', init: 10, qty: 1, isPC: false, maxHp: 7, units: [{ id: 'u', hp: 3 }], loot: [], currency: { cp: 0, sp: 0, gp: 0, pp: 0 }, notes: '' }, fromLibrary(m as LibraryMonster), (nativeArmor as Record<string, string[]>)[m.id]);
}
describe('Loot-driven stats', () => {
  it('uses finesse, strength, ranged ability and CR proficiency', () => {
    const s = goblin().stats;
    const sword = findEquipment('short sword'), club = findEquipment('Club');
    if (!s || !sword || !club) throw new Error('Missing fixture');
    expect(weaponAttack(sword, s)).toEqual({ attack: 4, damage: '1d6+2 piercing' });
    expect(weaponAttack(club, s)).toEqual({ attack: 1, damage: '1d4-1 bludgeoning' });
    expect(proficiency(0.25)).toBe(2); expect(proficiency(5)).toBe(3); expect(proficiency(17)).toBe(6);
    expect(weaponAttack(sword, { ...s, abilities: [18, 8, 10, 10, 10, 10] }).attack).toBe(6);
  });
  it('keeps native attacks and HP; shield removal and collection lower AC once', () => {
    const c = goblin();
    expect(c.stats?.ac).toBe(15); expect(c.units[0]?.hp).toBe(3);
    expect(c.loot.filter(l => l.native).length).toBe(4);
    const shield = c.loot.find(l => l.equipmentId === 'shield');
    if (!shield) throw new Error('Shield missing');
    const taken = changeLoot(c, c.loot.map(l => l.id === shield.id ? { ...l, taken: true } : l));
    expect(taken.stats?.ac).toBe(13); expect(syncGear(taken).stats?.ac).toBe(13);
    expect(changeLoot(taken, c.loot).stats?.ac).toBe(15);
    expect(changeLoot(c, c.loot.filter(l => l.id !== shield.id)).stats?.ac).toBe(13);
  });
  it('adds attacks, swaps linked gear, and keeps unrelated native actions', () => {
    const c = goblin(), club = gearItem('Club');
    const added = changeLoot(c, [...c.loot, club]);
    expect(added.stats?.actions.length).toBe((c.stats?.actions.length ?? 0) + 1);
    expect(added.stats?.actions.find(a => a.name === 'Club')?.attack).toBe(1);
    const swapped = changeLoot({ ...added, stats: added.stats ? { ...added.stats, actions: added.stats.actions.filter(a => a.lootId !== club.id) } : undefined }, added.loot.map(l => l.id === club.id ? { ...l, name: 'Shortsword', equipmentId: 'shortsword' } : l));
    expect(swapped.stats?.actions.find(a => a.lootId === club.id)?.attack).toBe(4);
    expect(swapped.stats?.actions.find(a => a.name === 'Scimitar')?.attack).toBe(4);
    expect(changeLoot(swapped, swapped.loot.filter(l => l.id !== club.id)).stats?.actions.length).toBe(c.stats?.actions.length);
  });
  it('ordinary items do not change stats, and overrides survive recalculation', () => {
    const c = goblin(), club = gearItem('Club');
    expect(changeLoot(c, [...c.loot, gearItem('Ring of invisibility')]).stats).toEqual(c.stats);
    const added = changeLoot(c, [...c.loot, club]);
    if (!added.stats) throw new Error('Missing stats');
    const overridden = syncGear({ ...added, stats: { ...added.stats, ac: 20, actions: added.stats.actions.map(a => a.lootId === club.id ? { ...a, attack: 9, damage: '3d6 fire' } : a), abilities: [18, 14, 10, 10, 10, 10] } });
    expect(overridden.stats?.actions.find(a => a.lootId === club.id)?.attack).toBe(9);
    expect(overridden.stats?.actions.find(a => a.lootId === club.id)?.damage).toBe('3d6 fire');
    expect(overridden.stats?.ac).toBe(20);
    expect(changeLoot(overridden, overridden.loot.filter(l => l.equipmentId !== 'shield')).stats?.ac).toBe(18);
  });
  it('restores collected native attacks with their printed bonuses', () => {
    const c = goblin(), weapon = c.loot.find(l => l.equipmentId === 'scimitar');
    if (!weapon) throw new Error('Missing weapon');
    const taken = changeLoot(c, c.loot.map(l => l.id === weapon.id ? { ...l, taken: true } : l));
    expect(taken.stats?.actions.some(a => a.name === 'Scimitar')).toBe(false);
    expect(changeLoot(taken, c.loot).stats?.actions.find(a => a.name === 'Scimitar')?.attack).toBe(4);
  });
  it('body armor swaps use bundled AC formulas without stacking shields', () => {
    const c: Combatant = { ...goblin(), stats: blankStats('Custom'), loot: [], gearAc: 0 };
    const armor = changeLoot(c, [gearItem('Chain mail'), gearItem('Shield'), gearItem('Shield')]);
    expect(armor.stats?.ac).toBe(18);
    expect(changeLoot(armor, []).stats?.ac).toBe(10);
  });
});import magic from '@/data/magic-items.json';
import { magicLoot, type MagicItem } from './equipment';
describe('Magic and bonus gear', () => {
  const find = (id: string) => (magic as MagicItem[]).find(m => m.id === id)!;
  it('+N weapons and armor, protection rings, strength items', () => {
    const c = goblin();
    const sword = { ...gearItem('Longsword'), bonus: 2 };
    const w = changeLoot(c, [...c.loot, sword]);
    expect(w.stats?.actions.find(a => a.lootId === sword.id)).toMatchObject({ attack: 3, damage: '1d8+1 slashing' });
    const shield = c.loot.find(l => l.equipmentId === 'shield')!;
    expect(changeLoot(c, c.loot.map(l => l.id === shield.id ? { ...l, bonus: 1 } : l)).stats?.ac).toBe(16);
    expect(changeLoot(c, [...c.loot, magicLoot(find('ring-of-protection'))]).stats?.ac).toBe(16);
    const g = changeLoot(c, [...c.loot, magicLoot(find('gauntlets-of-ogre-power')), gearItem('Club')]);
    expect(g.stats?.actions.find(a => a.name === 'Club')?.attack).toBe(6);
    const generic = magicLoot(find('weapon-3'));
    expect(generic.name).toBe('Longsword +3');
    const scim = c.loot.find(l => l.equipmentId === 'scimitar')!;
    expect(changeLoot(c, c.loot.map(l => l.id === scim.id ? { ...l, bonus: 1 } : l)).stats?.actions.find(a => a.name === 'Scimitar')).toMatchObject({ attack: 5, damage: '1d6+3 slashing' });
  });
});
import { combatantFromLibrary, nativeArmorFor } from './equipment';
describe('Library import into an encounter', () => {
  const goblin = (monsters as unknown as LibraryMonster[]).find(m => m.name === 'Goblin')!;
  it('builds a full initiative row: stats, native gear, HP at full', () => {
    const c = combatantFromLibrary(goblin);
    expect(c.name).toBe('Goblin');
    expect(c.maxHp).toBe(7);
    expect(c.units.length).toBe(1);
    expect(c.units[0]?.hp).toBe(7);
    expect(c.stats?.ac).toBe(15);
    expect(c.loot.filter(l => l.native).length).toBe(4);
    expect(nativeArmorFor(goblin.id)).toContain('shield');
    expect(nativeArmorFor(null)).toEqual([]);
  });
});
