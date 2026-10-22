import { z } from "zod";

export const lootSchema = z.object({
  name: z.string().min(1).describe("Item name exactly as the adventure writes it"),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How many, if more than one (becomes ×N in the name)"),
  value: z
    .string()
    .optional()
    .describe('Free text, e.g. "50 gp" or "600 gp equivalent". Leave out for story items.'),
  description: z.string().optional().describe("What it does, kept short"),
  condition: z.string().optional().describe('How it is earned, e.g. "negotiation or combat only"'),
  harvest: z
    .object({ skill: z.string(), dc: z.number().int() })
    .optional()
    .describe("A check needed to take it, e.g. Medicine DC 14 to harvest venom"),
});
export type LootInput = z.infer<typeof lootSchema>;

const featureSchema = z.object({
  name: z.string(),
  desc: z.string(),
  attack: z.number().optional().describe("Attack bonus, if it is an attack"),
  damage: z.string().optional().describe('e.g. "1d8+3 slashing"'),
});

export const customMonsterSchema = z.object({
  name: z.string(),
  meta: z
    .string()
    .optional()
    .describe('Size, type, alignment, e.g. "Medium humanoid, lawful evil"'),
  ac: z.number(),
  acNote: z.string().optional(),
  hp: z.number(),
  hitDice: z.string().optional(),
  speed: z.string().optional(),
  abilities: z.array(z.number()).length(6).optional().describe("STR DEX CON INT WIS CHA"),
  saves: z.string().optional(),
  skills: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  cr: z.number().optional(),
  resist: z.string().optional(),
  immune: z.string().optional(),
  vuln: z.string().optional(),
  condImmune: z.string().optional(),
  traits: z.array(featureSchema).optional(),
  actions: z.array(featureSchema).optional(),
  reactions: z.array(featureSchema).optional(),
  legendary: z.array(featureSchema).optional(),
});
export type CustomMonster = z.infer<typeof customMonsterSchema>;

export const overridesSchema = z
  .object({
    hp: z.number().optional(),
    hitDice: z.string().optional(),
    ac: z.number().optional(),
    acNote: z.string().optional(),
    speed: z.string().optional(),
    cr: z.number().optional(),
  })
  .describe(
    "Changes to a library creature's printed stats, e.g. { hp: 38 } for 'Lizardfolk Warrior at 38 HP'",
  );

export const groupSchema = z
  .object({
    name: z.string().optional().describe("What the GM calls them, if not the monster name"),
    monster: z
      .string()
      .optional()
      .describe(
        "Library creature name, e.g. Zombie. Use this when the adventure cites a standard creature.",
      ),
    custom: customMonsterSchema
      .optional()
      .describe("A full stat block written in the adventure. Never invent one."),
    count: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(1)
      .describe("Default number; the GM adjusts it before the fight"),
    countNote: z
      .string()
      .optional()
      .describe('The adventure\'s own rule, e.g. "1 per PC" or "4-6"'),
    overrides: overridesSchema.optional(),
    joins: z
      .union([z.literal("start"), z.literal("manual"), z.number().int().min(1)])
      .optional()
      .describe('"start" (default), a round number, or "manual" when the GM calls them in'),
    npc: z.string().optional().describe("Name of the NPC this group is, for named characters"),
    notes: z.string().optional(),
    loot: z.array(lootSchema).optional().describe("Loot this group carries"),
  })
  .refine((g) => g.monster || g.custom, { message: "Each group needs `monster` or `custom`" });
export type GroupInput = z.infer<typeof groupSchema>;

export const LOCATION_MAX = 60;
export const locationSchema = z
  .string()
  .max(
    LOCATION_MAX,
    `Location is a short room key (${LOCATION_MAX} characters or fewer), like "U3" or "G1 Conservatory". Scene prose belongs in setting.`,
  );

export const folderSchema = z
  .string()
  .refine((p) => p.split("/").filter((x) => x.trim()).length <= 3, {
    message: 'Folders nest 3 levels deep at most, e.g. "If they join the band / Sent on the raid".',
  })
  .describe(
    'Folder path in the sidebar, outermost first, e.g. "Night 1 / River Fort". Created if missing, 3 levels at most. Group by story branch, not by session. Leave out for the top level.',
  );

export const beatSchema = z.object({
  round: z
    .union([
      z.number().int().min(1),
      z
        .string()
        .regex(/^\s*\d+\s*\+\s*$/, 'Use a round number, or "6+" for round 6 and every round after'),
    ])
    .describe('A round number, or "6+" for round 6 and every round after'),
  text: z.string(),
});

export const encounterSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  folder: folderSchema.optional(),
  location: locationSchema
    .optional()
    .describe(
      'A short room or scene key from the adventure, e.g. "G1" or "U3 Orlen\'s Chamber"; 60 characters at most. If none, the scene name. Never a paragraph.',
    ),
  status: z
    .enum(["staged", "dormant"])
    .optional()
    .describe("dormant = only happens on a condition (give a trigger)"),
  trigger: z
    .string()
    .optional()
    .describe("PREP NOTE. What has to happen first, for a dormant encounter."),
  tactics: z.string().optional().describe("PREP NOTE (DM only). How they fight."),
  morale: z.string().optional().describe("PREP NOTE (DM only). When and how they break or run."),
  setting: z
    .string()
    .optional()
    .describe(
      "SETTING (read aloud): one short paragraph the GM reads to the table, where they are and what is immediately visible. Not tactics, not loot, not the room's lore. Those are prep notes.",
    ),
  beats: z.array(beatSchema).optional(),
  groups: z.array(groupSchema).default([]),
  loot: z
    .array(lootSchema)
    .optional()
    .describe("Loot lying in the room, not carried by a creature"),
  distinct: z
    .boolean()
    .optional()
    .describe(
      "Set only after the GM confirmed this is a different encounter from a similar existing one",
    ),
});
export type EncounterInput = z.infer<typeof encounterSchema>;

export const npcSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional().describe("Who they are, one line"),
  firstAppearance: z.string().optional(),
  notes: z.string().optional(),
  race: z.string().optional(),
  classes: z.string().optional(),
  ac: z.number().int().optional(),
  acNote: z.string().optional().describe('e.g. "15 with mage armor"'),
  maxHp: z.number().int().optional(),
  speed: z.string().optional(),
  abilities: z
    .array(z.number().int())
    .length(6)
    .optional()
    .describe("Scores in the order STR, DEX, CON, INT, WIS, CHA"),
  saves: z.string().optional().describe('e.g. "Wis +7, Int +7"'),
  passive: z.number().int().optional().describe("Passive Perception"),
  senses: z.string().optional(),
  attacks: z
    .array(
      z.object({
        name: z.string(),
        attack: z.string().describe('To-hit, e.g. "+7"'),
        damage: z.string().describe('e.g. "2d10 fire"'),
      }),
    )
    .optional()
    .describe("Replaces the NPC's attacks"),
  spellAbility: z.string().optional().describe('e.g. "Intelligence"'),
  spellDc: z.number().int().optional(),
  spellAttack: z.number().int().optional(),
  prepared: z
    .array(z.string())
    .optional()
    .describe("Spell names the NPC has ready (cantrips included). Replaces the prepared list."),
  slots: z
    .array(
      z.object({ level: z.number().int().min(1).max(9), count: z.number().int().min(1).max(9) }),
    )
    .optional()
    .describe("Spell slots per level, e.g. [{level:1,count:4}]. Replaces the NPC's slots."),
  spellbook: z
    .array(z.string())
    .optional()
    .describe(
      "Every spell the NPC knows. Saved as a named list on the Spell Book page; SRD spells link to their full text, others are reported back.",
    ),
  gear: z
    .array(z.object({ name: z.string(), note: z.string().optional() }))
    .optional()
    .describe("Carried gear and notable items. Replaces the gear list."),
  resources: z
    .array(
      z.object({
        name: z.string().describe('e.g. "Channel Divinity"'),
        max: z.number().int().min(1),
        current: z.number().int().min(0).optional().describe("Defaults to max"),
        reset: z
          .enum(["short", "long"])
          .nullable()
          .optional()
          .describe("Rest that refills it; null or omitted = manual"),
      }),
    )
    .optional()
    .describe("Limited uses that are not spell slots. Replaces the list."),
  distinct: z
    .boolean()
    .optional()
    .describe(
      "Set only after the GM confirmed this is a different person from a similar existing NPC",
    ),
});
export const pcSchema = npcSchema.omit({ firstAppearance: true });
export type NpcInput = z.infer<typeof npcSchema>;

export const bundleSchema = z.object({
  campaign: z.string().optional(),
  session: z
    .string()
    .min(1)
    .describe('Label for the adventure session, e.g. "Winwoods S1 - Homecoming"'),
  npcs: z.array(npcSchema).default([]),
  encounters: z.array(encounterSchema).default([]),
});
export type Bundle = z.infer<typeof bundleSchema>;
