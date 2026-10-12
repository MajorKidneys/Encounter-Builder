import { beforeEach, describe, expect, it } from "vitest";
import {
  CAMPAIGN_INDEX_KEY,
  addCampaign,
  campaignDataKey,
  loadCampaignStore,
  removeCampaign,
  removeCampaignData,
  renameCampaign,
  saveCampaignStore,
  useCampaignStore,
} from "./campaigns";
import { renderHook, act, waitFor } from "@testing-library/react";

const encounter = { id: "e1", name: "Death House", archived: false, createdAt: 1, combatants: [] };

beforeEach(() => localStorage.clear());

describe("campaign storage", () => {
  it("migrates the old single campaign and leaves those keys as a backup", () => {
    localStorage.setItem("dm-campaign-name-v1", "Curse of Strahd");
    localStorage.setItem("dm-encounters-v1", JSON.stringify([encounter]));
    localStorage.setItem(
      "dm-spell-lists-v1",
      JSON.stringify([{ id: "l1", name: "Cleric", spellIds: ["cure-wounds"] }]),
    );

    const store = loadCampaignStore(localStorage);

    expect(store.campaigns).toHaveLength(1);
    expect(store.campaigns[0]?.name).toBe("Curse of Strahd");
    expect(store.data[store.activeId]?.encounters).toEqual([encounter]);
    expect(store.data[store.activeId]?.spellLists).toEqual([
      { id: "l1", name: "Cleric", spellIds: ["cure-wounds"] },
    ]);
    expect(store.data[store.activeId]?.characters).toEqual([]);
    expect(localStorage.getItem("dm-encounters-v1")).toContain("Death House");

    const again = loadCampaignStore(localStorage);
    expect(again.campaigns).toHaveLength(1);
    expect(again.campaigns[0]?.id).toBe(store.campaigns[0]?.id);
  });

  it("starts a fresh campaign when nothing is saved", () => {
    const store = loadCampaignStore(localStorage);
    expect(store.campaigns).toEqual([expect.objectContaining({ name: "YOUR ADVENTURE" })]);
    expect(store.data[store.activeId]?.encounters).toEqual([]);
    expect(store.data[store.activeId]?.spellLists.map((l) => l.name)).toEqual(["Favorites"]);
    expect(store.data[store.activeId]?.characters).toEqual([]);
  });

  it("keeps encounters, spell lists, and characters inside the campaign they were written to", () => {
    const first = loadCampaignStore(localStorage);
    const second = addCampaign(first, "Testing");
    const testingId = second.activeId;
    const homeId = first.activeId;
    second.data[homeId]!.encounters = [encounter];
    second.data[homeId]!.characters = [
      { id: "pc1", name: "Nyx", maxHp: 27, notes: "Aasimar cleric" },
    ];
    second.data[testingId]!.spellLists = [{ id: "t1", name: "Scratch", spellIds: [] }];
    saveCampaignStore(localStorage, second);

    const loaded = loadCampaignStore(localStorage);
    expect(loaded.data[homeId]?.encounters).toEqual([encounter]);
    expect(loaded.data[homeId]?.characters[0]?.name).toBe("Nyx");
    expect(loaded.data[testingId]?.encounters).toEqual([]);
    expect(loaded.data[testingId]?.characters).toEqual([]);
    expect(loaded.data[testingId]?.spellLists.map((l) => l.name)).toEqual(["Scratch"]);
    expect(loaded.data[homeId]?.spellLists.map((l) => l.name)).toEqual(["Favorites"]);
  });

  it("renames, switches, and refuses to delete the last campaign", () => {
    let store = loadCampaignStore(localStorage);
    const home = store.activeId;
    store = renameCampaign(store, home, "Tomb of Annihilation");
    store = addCampaign(store, "Testing");
    const testing = store.activeId;
    expect(store.campaigns.map((c) => c.name)).toEqual(["Tomb of Annihilation", "Testing"]);

    const kept = removeCampaign(store, home);
    expect(kept.removedId).toBe(home);
    expect(kept.store.activeId).toBe(testing);
    expect(removeCampaign(kept.store, testing).removedId).toBeNull();
  });

  it("drops a deleted campaign's storage keys", () => {
    const store = addCampaign(loadCampaignStore(localStorage), "Testing");
    saveCampaignStore(localStorage, store);
    const removed = store.campaigns[0]!.id;
    removeCampaignData(localStorage, removed);
    expect(localStorage.getItem(campaignDataKey(removed, "encounters"))).toBeNull();
    expect(localStorage.getItem(CAMPAIGN_INDEX_KEY)).toContain("Testing");
  });
});

describe("useCampaignStore", () => {
  it("persists the active campaign and isolates edits", async () => {
    const { result } = renderHook(() => useCampaignStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const home = result.current.campaignId!;

    act(() => result.current.renameCampaign("Home game"));
    act(() => result.current.setEncounters([encounter]));
    act(() => result.current.setCharacters([{ id: "pc1", name: "Nyx", maxHp: 27, notes: "" }]));
    let testing = "";
    act(() => {
      testing = result.current.createCampaign()?.id ?? "";
    });

    expect(result.current.campaign?.name).toBe("New campaign");
    expect(result.current.encounters).toEqual([]);
    expect(result.current.characters).toEqual([]);

    act(() => result.current.selectCampaign(home));
    expect(result.current.encounters).toEqual([encounter]);
    expect(result.current.characters[0]?.name).toBe("Nyx");

    act(() => result.current.deleteCampaign(testing));
    expect(result.current.campaigns.map((c) => c.id)).toEqual([home]);
    expect(localStorage.getItem(campaignDataKey(testing, "characters"))).toBeNull();

    const reloaded = loadCampaignStore(localStorage);
    expect(reloaded.activeId).toBe(home);
    expect(reloaded.data[home]?.encounters[0]?.name).toBe("Death House");
    expect(reloaded.data[home]?.characters[0]?.name).toBe("Nyx");
  });
});
