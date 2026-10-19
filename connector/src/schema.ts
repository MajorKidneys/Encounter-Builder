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

export const beatSchema = z.object({
  round: z
    .union([z.number().int().min(1), z.string()])
    .describe('A round number, or "6+" for round 6 and every round after'),
  text: z.string(),
});

export const encounterSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  location: z
    .string()
    .optional()
    .describe(
      'Room or scene key from the adventure, e.g. "G1" or "U3 Orlen\'s Chamber". If none, the scene name.',
    ),
  status: z
    .enum(["staged", "dormant"])
    .optional()
    .describe("dormant = only happens on a condition (give a trigger)"),
  trigger: z.string().optional(),
  tactics: z.string().optional(),
  morale: z.string().optional(),
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
  distinct: z
    .boolean()
    .optional()
    .describe(
      "Set only after the GM confirmed this is a different person from a similar existing NPC",
    ),
});
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
