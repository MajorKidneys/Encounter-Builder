import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { uid, type Encounter } from "./encounters";
import { coerceCharacter, type Character } from "./characters";
import { type SpellList } from "./spells";

/** Directory of campaigns. Encounter, spell-list, and party data live in per-campaign keys. */
export const CAMPAIGN_INDEX_KEY = "dm-campaigns-v2";
const LEGACY_NAME_KEY = "dm-campaign-name-v1";
const LEGACY_ENCOUNTERS_KEY = "dm-encounters-v1";
const LEGACY_SPELLS_KEY = "dm-spell-lists-v1";
export const DEFAULT_CAMPAIGN_NAME = "YOUR ADVENTURE";

export type CampaignMeta = { id: string; name: string; createdAt: number };
export type CampaignData = {
  encounters: Encounter[];
  spellLists: SpellList[];
  characters: Character[];
};
export type CampaignStore = {
  activeId: string;
  campaigns: CampaignMeta[];
  data: Record<string, CampaignData>;
};

export function campaignDataKey(id: string, part: "encounters" | "spell-lists" | "characters") {
  return `dm-c-${id}-${part}`;
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function isMeta(value: unknown): value is CampaignMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as CampaignMeta;
  return (
    typeof meta.id === "string" &&
    typeof meta.name === "string" &&
    typeof meta.createdAt === "number"
  );
}

export function emptySpellLists(): SpellList[] {
  return [{ id: uid(), name: "Favorites", spellIds: [] }];
}

export function blankCampaignData(): CampaignData {
  return { encounters: [], spellLists: emptySpellLists(), characters: [] };
}

function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

function readData(storage: Storage, id: string): CampaignData {
  const encounters = asArray<Encounter>(readJson(storage, campaignDataKey(id, "encounters"))) ?? [];
  const spellLists =
    asArray<SpellList>(readJson(storage, campaignDataKey(id, "spell-lists"))) ?? emptySpellLists();
  const characters = (asArray<unknown>(readJson(storage, campaignDataKey(id, "characters"))) ?? [])
    .map(coerceCharacter)
    .filter((c): c is Character => c !== null);
  return { encounters, spellLists, characters };
}

function legacyStore(storage: Storage): CampaignStore {
  const savedName = storage.getItem(LEGACY_NAME_KEY);
  const name = savedName?.trim() || DEFAULT_CAMPAIGN_NAME;
  const id = uid();
  const encounters = asArray<Encounter>(readJson(storage, LEGACY_ENCOUNTERS_KEY)) ?? [];
  const spellLists = asArray<SpellList>(readJson(storage, LEGACY_SPELLS_KEY)) ?? emptySpellLists();
  return {
    activeId: id,
    campaigns: [{ id, name, createdAt: Date.now() }],
    data: { [id]: { encounters, spellLists, characters: [] } },
  };
}

/** Loads the campaign directory, migrating the old single-campaign keys the first time. */
export function loadCampaignStore(storage: Storage): CampaignStore {
  const index = readJson(storage, CAMPAIGN_INDEX_KEY) as
    { activeId?: unknown; campaigns?: unknown } | undefined;
  const campaigns = Array.isArray(index?.campaigns) ? index.campaigns.filter(isMeta) : null;
  if (!campaigns || campaigns.length === 0) {
    const migrated = legacyStore(storage);
    saveCampaignStore(storage, migrated);
    return migrated;
  }
  const activeId = campaigns.some((c) => c.id === index?.activeId)
    ? (index?.activeId as string)
    : campaigns[0]!.id;
  const data: Record<string, CampaignData> = {};
  for (const campaign of campaigns) data[campaign.id] = readData(storage, campaign.id);
  return { activeId, campaigns, data };
}

export function saveCampaignStore(storage: Storage, store: CampaignStore) {
  storage.setItem(
    CAMPAIGN_INDEX_KEY,
    JSON.stringify({ activeId: store.activeId, campaigns: store.campaigns }),
  );
  for (const campaign of store.campaigns) {
    const data = store.data[campaign.id] ?? blankCampaignData();
    storage.setItem(campaignDataKey(campaign.id, "encounters"), JSON.stringify(data.encounters));
    storage.setItem(campaignDataKey(campaign.id, "spell-lists"), JSON.stringify(data.spellLists));
    storage.setItem(campaignDataKey(campaign.id, "characters"), JSON.stringify(data.characters));
  }
}

export function removeCampaignData(storage: Storage, id: string) {
  storage.removeItem(campaignDataKey(id, "encounters"));
  storage.removeItem(campaignDataKey(id, "spell-lists"));
  storage.removeItem(campaignDataKey(id, "characters"));
}

export function campaignName(campaigns: CampaignMeta[], fallback: string) {
  const taken = new Set(campaigns.map((c) => c.name));
  if (!taken.has(fallback)) return fallback;
  let n = 2;
  while (taken.has(`${fallback} ${n}`)) n += 1;
  return `${fallback} ${n}`;
}

export function addCampaign(store: CampaignStore, name = "New campaign"): CampaignStore {
  const id = uid();
  return {
    ...store,
    activeId: id,
    campaigns: [
      ...store.campaigns,
      { id, name: campaignName(store.campaigns, name), createdAt: Date.now() },
    ],
    data: { ...store.data, [id]: blankCampaignData() },
  };
}

export function renameCampaign(store: CampaignStore, id: string, name: string): CampaignStore {
  return { ...store, campaigns: store.campaigns.map((c) => (c.id === id ? { ...c, name } : c)) };
}

/** Refuses to remove the last campaign. Returns the removed id when one was deleted. */
export function removeCampaign(
  store: CampaignStore,
  id: string,
): { store: CampaignStore; removedId: string | null } {
  if (store.campaigns.length < 2 || !store.campaigns.some((c) => c.id === id))
    return { store, removedId: null };
  const campaigns = store.campaigns.filter((c) => c.id !== id);
  const data = { ...store.data };
  delete data[id];
  const activeId = store.activeId === id ? campaigns[0]!.id : store.activeId;
  return { store: { activeId, campaigns, data }, removedId: id };
}

function patchActive(store: CampaignStore, patch: Partial<CampaignData>): CampaignStore {
  const current = store.data[store.activeId] ?? blankCampaignData();
  return { ...store, data: { ...store.data, [store.activeId]: { ...current, ...patch } } };
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function commit(storeRef: { current: CampaignStore | null }, next: CampaignStore) {
  storeRef.current = next;
  return next;
}

export function useCampaignStore() {
  const [store, setStore] = useState<CampaignStore | null>(null);
  const storeRef = useRef<CampaignStore | null>(null);
  storeRef.current = store;
  useEffect(() => {
    const storage = browserStorage();
    const loaded = storage ? loadCampaignStore(storage) : legacyStore(emptyStorage());
    storeRef.current = loaded;
    setStore(loaded);
  }, []);
  useEffect(() => {
    const storage = browserStorage();
    if (store && storage) saveCampaignStore(storage, store);
  }, [store]);

  const ready = store !== null;
  const active = store?.data[store.activeId];
  const replace = (next: CampaignStore) => setStore(commit(storeRef, next));
  const setSlice =
    <K extends keyof CampaignData>(key: K): Dispatch<SetStateAction<CampaignData[K]>> =>
    (action) => {
      const prev = storeRef.current;
      if (!prev) return;
      const current = prev.data[prev.activeId] ?? blankCampaignData();
      const value = typeof action === "function" ? action(current[key]) : action;
      replace(patchActive(prev, { [key]: value }));
    };

  return {
    ready,
    campaigns: store?.campaigns ?? [],
    campaignId: store?.activeId ?? null,
    campaign: store?.campaigns.find((c) => c.id === store.activeId) ?? null,
    encounters: active?.encounters ?? [],
    setEncounters: setSlice("encounters"),
    lists: active?.spellLists ?? [],
    setLists: setSlice("spellLists"),
    characters: active?.characters ?? [],
    setCharacters: setSlice("characters"),
    selectCampaign: (id: string) => {
      const prev = storeRef.current;
      if (!prev || !prev.campaigns.some((c) => c.id === id)) return;
      replace({ ...prev, activeId: id });
    },
    createCampaign: () => {
      const prev = storeRef.current;
      if (!prev) return null;
      const next = addCampaign(prev);
      replace(next);
      const data = next.data[next.activeId]!;
      return { id: next.activeId, listId: data.spellLists[0]?.id ?? null };
    },
    renameCampaign: (name: string) => {
      const prev = storeRef.current;
      if (!prev) return;
      replace(renameCampaign(prev, prev.activeId, name));
    },
    deleteCampaign: (id: string) => {
      const prev = storeRef.current;
      if (!prev) return null;
      const result = removeCampaign(prev, id);
      replace(result.store);
      const storage = browserStorage();
      if (result.removedId && storage) removeCampaignData(storage, result.removedId);
      return result.removedId;
    },
  };
}

function emptyStorage(): Storage {
  return {
    length: 0,
    clear() {},
    getItem: () => null,
    setItem() {},
    removeItem() {},
    key: () => null,
  };
}
