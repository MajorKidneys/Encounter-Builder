/**
 * One-time (re)build of src/data/dm-reference.json from the 2014 SRD API.
 * The app never calls the network; it imports the file this script writes.
 *
 * Run: node scripts/build-reference.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.dnd5eapi.co/api/2014";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_RULES = [
  "combat-step-by-step",
  "your-turn",
  "reactions",
  "attack",
  "cast-a-spell",
  "dash",
  "disengage",
  "dodge",
  "help",
  "hide",
  "ready",
  "search",
  "use-an-object",
  "melee-attacks",
  "cover",
  "dropping-to-0-hit-points",
  "surprise",
  "difficult-terrain",
  "special-types-of-movement",
  "being-prone",
  "speed",
  "vision-and-light",
  "resting",
  "short-rest",
  "long-rest",
  "falling",
  "suffocating",
  "food-and-water",
  "traps-in-play",
  "statistics-for-objects",
  "advantage-and-disadvantage",
  "passive-checks",
  "working-together",
  "contests",
  "typical-difficulty-classes",
  "skills",
  "damage-resistance-and-vulnerability",
  "duration",
];

const REQUIRED_CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
];

/** Tooltip lines already shipped on condition chips. Keep them stable. */
const CONDITION_SHORTS = {
  blinded: "Can't see. Attacks against it have advantage; its attacks have disadvantage.",
  charmed: "Can't attack the charmer. The charmer has advantage on social checks against it.",
  deafened: "Can't hear. Fails checks that rely on hearing.",
  frightened:
    "Disadvantage on checks and attacks while the source is in sight. Can't move closer to it.",
  grappled: "Speed is 0.",
  incapacitated: "Can't take actions or reactions.",
  invisible: "Attacks against it have disadvantage; its attacks have advantage.",
  paralyzed:
    "Incapacitated, can't move or speak. Fails Str and Dex saves. Hits from within 5 ft are crits.",
  petrified: "Turned to stone. Incapacitated, resistant to all damage.",
  poisoned: "Disadvantage on attack rolls and ability checks.",
  prone: "Can only crawl. Disadvantage on attacks. Melee attacks against it have advantage.",
  restrained: "Speed 0. Disadvantage on attacks and Dex saves. Attacks against it have advantage.",
  stunned:
    "Incapacitated, can barely speak. Fails Str and Dex saves. Attacks against it have advantage.",
  unconscious: "Incapacitated and prone, drops what it holds. Hits from within 5 ft are crits.",
  exhaustion: "Six levels. Each level adds a further penalty; level 6 is death.",
};

const CHANGED = {
  exhaustion:
    "Each level is a −2 penalty on attacks, checks, and saves, and −5 feet of speed, instead of the effects below.",
  grappled:
    "A grappled creature also has disadvantage on attack rolls against anyone other than the grappler.",
  surprise: "A surprised creature rolls initiative with disadvantage instead of skipping its first turn.",
  invisible:
    "You also have advantage on initiative if you are invisible when you roll it, and effects that must see you cannot target you.",
  incapacitated: "You also cannot take a bonus action or speak, and your concentration ends.",
  stunned: "Speaking is covered by Incapacitated, which now stops you from speaking at all.",
  hide: "Hide is a DC 15 Dexterity (Stealth) check, and a success gives you the Invisible condition.",
  burning:
    "A burning creature takes 1d4 fire damage at the start of each of its turns until an action puts the fire out.",
};

async function getJson(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`SRD API ${res.status} for ${path}`);
  return res.json();
}

function asText(desc) {
  if (Array.isArray(desc)) return desc.filter(Boolean).join("\n");
  if (typeof desc !== "string" || !desc.trim()) throw new Error("Missing SRD description");
  return desc;
}

function requireHeading(text, heading) {
  const re = new RegExp(`^#### ${heading}\\s*$`, "m");
  const match = re.exec(text);
  if (!match) throw new Error(`SRD section is missing heading "${heading}"`);
  const rest = text.slice(match.index + match[0].length).replace(/^\n/, "");
  const next = rest.search(/^#### /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function parseRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function splitTables(text) {
  const lines = text.split("\n");
  const tables = [];
  const kept = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(next)) {
      const block = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        block.push(lines[i]);
        i += 1;
      }
      const columns = parseRow(block[0] ?? "");
      const rows = block.slice(2).filter((row) => row.trim()).map(parseRow);
      if (!columns.length || rows.some((row) => row.length !== columns.length)) {
        throw new Error(`Unreadable SRD table:\n${block.join("\n")}`);
      }
      tables.push({ columns, rows });
      continue;
    }
    kept.push(line);
    i += 1;
  }
  return { text: cleanBody(kept.join("\n")), tables };
}

function cleanBody(text) {
  return text
    .replace(/^#{2,6} +(.+)$/gm, "**$1**")
    .replace(/\*\*\*(.+?)\*\*\*/g, "**$1**")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstSentence(text) {
  const plain = text
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = plain.match(/^(.+?[.!?])(?:\s|$)/);
  let sentence = (match ? match[1] : plain).trim();
  if (sentence.length > 160) {
    sentence = `${sentence.slice(0, 159).replace(/\s+\S*$/, "")}…`;
  }
  if (!sentence || sentence.length > 160) throw new Error(`Bad short text: ${sentence}`);
  return sentence;
}

function entry(partial) {
  const next = { edition: "2014", source: "SRD 5.1", ...partial };
  if (!next.short || next.short.length > 160) {
    throw new Error(`Short text for ${next.id} is ${next.short?.length ?? 0} chars`);
  }
  if (CHANGED[next.id]) next.changedIn2024 = CHANGED[next.id];
  return next;
}

function fromRule(rule, { id, term, category, aliases, related, short, heading, text }) {
  const raw = text ?? (heading ? requireHeading(asText(rule.desc), heading) : asText(rule.desc));
  const { text: body, tables } = splitTables(raw);
  if (tables.length > 1) throw new Error(`${id} has ${tables.length} tables`);
  const result = entry({
    id,
    term,
    category,
    short: short ?? firstSentence(body),
    body,
  });
  if (tables[0]) result.table = tables[0];
  if (aliases) result.aliases = aliases;
  if (related) result.related = related;
  return result;
}

function conditionBody(desc) {
  const lines = Array.isArray(desc) ? desc : [desc];
  const levels = [];
  const prose = [];
  for (const line of lines) {
    const level = /^(\d+)\s+-\s+(.+)$/.exec(line.trim());
    if (level) levels.push([level[1], level[2]]);
    else prose.push(line.trim());
  }
  if (levels.length) {
    return {
      body: cleanBody(prose.join("\n\n")),
      table: { columns: ["Level", "Effect"], rows: levels },
    };
  }
  const bullets = lines.every((line) => line.trim().startsWith("- "));
  const body = bullets ? lines.map((line) => line.trim()).join("\n") : lines.join("\n\n");
  return { body: cleanBody(body), table: undefined };
}

function mergeTrapTable(tables) {
  if (tables.length !== 2) throw new Error(`Expected 2 trap tables, found ${tables.length}`);
  const [save, damage] = tables;
  const column = { setback: 1, dangerous: 2, deadly: 3 };
  const rows = save.rows.map((row) => {
    const key = row[0]?.toLowerCase();
    const index = column[key];
    if (!index) throw new Error(`Unexpected trap severity ${row[0]}`);
    return [row[0], row[1], row[2], ...damage.rows.map((level) => level[index])];
  });
  return {
    columns: ["Severity", "Save DC", "Attack bonus", "Lv 1–4", "Lv 5–10", "Lv 11–16", "Lv 17–20"],
    rows,
  };
}

function written(partial) {
  return entry({ ...partial, source: "Written for this app" });
}

const rules = {};
for (const index of REQUIRED_RULES) {
  rules[index] = await getJson(`/rules/${index}`);
  if (rules[index].index !== index) throw new Error(`SRD rule ${index} did not load`);
}

const conditions = {};
for (const index of REQUIRED_CONDITIONS) {
  conditions[index] = await getJson(`/conditions/${index}`);
  if (conditions[index].index !== index) throw new Error(`SRD condition ${index} did not load`);
}

const damageTypes = await getJson("/damage-types");
const typeNames = (damageTypes.results ?? []).map((type) => type.name).filter(Boolean);
if (typeNames.length < 10) throw new Error("SRD damage type list is missing");

const melee = asText(rules["melee-attacks"].desc);
const movementBits = [
  asText(rules["difficult-terrain"].desc),
  requireHeading(asText(rules["special-types-of-movement"].desc), "Climbing, Swimming, and Crawling"),
  asText(rules["being-prone"].desc),
].join("\n\n");
const restingBits = [
  asText(rules.resting.desc),
  asText(rules["short-rest"].desc),
  asText(rules["long-rest"].desc),
].join("\n\n");
const yourTurnBits = [asText(rules["your-turn"].desc), asText(rules.reactions.desc)].join("\n\n");
const objectRaw = asText(rules["statistics-for-objects"].desc);
const objectSplit = objectRaw.split("***Hit Points.***");
if (objectSplit.length !== 2) throw new Error("Object statistics section did not split into AC and HP");

const trapSplit = splitTables(asText(rules["traps-in-play"].desc));
if (trapSplit.tables.length !== 2) throw new Error("Trap section is missing a table");

const entries = [];

entries.push(
  written({
    id: "when-in-doubt",
    term: "When in Doubt",
    category: "start",
    short: "If failure would be interesting, call for a check. Otherwise, it just happens.",
    body: "If the outcome is uncertain and failure is interesting, call for a check. Otherwise it just happens.\n\nMake situational modifiers advantage or disadvantage rather than changing the DC. Make a call, keep play moving, and look the rule up after the session.",
    related: ["typical-dcs", "advantage"],
  }),
);

const full = [];

full.push(
  fromRule(rules["typical-difficulty-classes"], {
    id: "typical-dcs",
    term: "Typical DCs",
    category: "rulings",
    short: "5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible.",
  }),
);
full.push(
  fromRule(rules["combat-step-by-step"], {
    id: "combat-flow",
    term: "Combat Flow",
    category: "combat",
    short: "Determine surprise, place combatants, roll initiative, then take turns until the fight ends.",
    related: ["your-turn", "surprise"],
  }),
);
full.push(
  fromRule(rules["your-turn"], {
    id: "your-turn",
    term: "Your Turn",
    category: "combat",
    text: yourTurnBits,
    short:
      "Move, one action, a bonus action only if something grants it, and one free object interaction.",
    related: ["combat-flow", "ready", "reactions-note"],
  }),
);

// reactions is folded into Your Turn; drop the dangling related id before validation by not linking it.
full[full.length - 1].related = ["combat-flow", "ready"];

for (const action of [
  ["attack", "Attack"],
  ["cast-a-spell", "Cast a Spell"],
  ["dash", "Dash"],
  ["disengage", "Disengage"],
  ["dodge", "Dodge"],
  ["help", "Help"],
  ["hide", "Hide"],
  ["ready", "Ready"],
  ["search", "Search"],
  ["use-an-object", "Use an Object"],
]) {
  full.push(
    fromRule(rules[action[0]], {
      id: action[0] === "cast-a-spell" ? "cast-a-spell" : action[0],
      term: action[1],
      category: "combat",
      related: ["your-turn"],
    }),
  );
}

full.push(
  fromRule(rules["melee-attacks"], {
    id: "opportunity-attacks",
    term: "Opportunity Attacks",
    category: "combat",
    heading: "Opportunity Attacks",
    related: ["disengage"],
    aliases: ["aoo"],
  }),
);
full.push(
  fromRule(rules.cover, {
    id: "cover",
    term: "Cover",
    category: "combat",
    short: "Half cover +2 AC and Dex saves. Three-quarters cover +5. Total cover can't be targeted.",
    aliases: ["half cover", "three-quarters cover"],
  }),
);
full.push(
  fromRule(rules["dropping-to-0-hit-points"], {
    id: "dropping-to-0-hp",
    term: "Dropping to 0 HP",
    category: "combat",
    short:
      "Death saves are DC 10. Three successes stabilize, three failures die. A nat 20 means 1 HP.",
    related: ["unconscious", "concentration"],
    aliases: ["death save", "death saves", "stable"],
  }),
);
full.push(
  fromRule(rules["melee-attacks"], {
    id: "grappling-and-shoving",
    term: "Grappling & Shoving",
    category: "combat",
    text: [
      requireHeading(melee, "Grappling"),
      requireHeading(melee, "Shoving a Creature"),
    ].join("\n\n"),
    short: "Use an attack to grab a creature or to knock it prone or push it away.",
    related: ["grappled", "prone"],
    aliases: ["shove", "grapple"],
  }),
);
full.push(
  fromRule(rules["melee-attacks"], {
    id: "two-weapon-fighting",
    term: "Two-Weapon Fighting",
    category: "combat",
    heading: "Two-Weapon Fighting",
    aliases: ["dual wield", "two weapon"],
  }),
);
full.push(
  fromRule(rules.surprise, {
    id: "surprise",
    term: "Surprise",
    category: "combat",
    related: ["combat-flow", "hide"],
  }),
);
full.push(
  written({
    id: "holding-your-action",
    term: "Holding Your Action",
    category: "combat",
    short: "Leave your place in initiative and act later, before someone else's turn.",
    body: "Holding in this tracker means leaving the initiative order so you can act later. It is not the Grappled condition, and it is not the Ready action.\n\nPress **Hold** on your turn. The row stays marked **Holding**. Press **Act now** when that creature should act, ahead of whoever is currently up.\n\nThe Ready action is the rules version: you choose a trigger, then spend your reaction when it happens.",
    related: ["ready", "grappled"],
    aliases: ["hold", "delay", "act now"],
  }),
);

const movement = fromRule(rules["difficult-terrain"], {
  id: "movement",
  term: "Movement",
  category: "movement",
  text: movementBits,
  short:
    "Difficult terrain, climbing, swimming, and crawling cost 1 extra foot per foot. Standing costs half your speed.",
  related: ["jumping", "prone"],
});
full.push(movement);
full.push(
  fromRule(rules["special-types-of-movement"], {
    id: "jumping",
    term: "Jumping",
    category: "movement",
    heading: "Jumping",
    short: "Long jump is your Strength score in feet with a 10-foot run. High jump is 3 + your Strength modifier.",
    related: ["movement"],
    aliases: ["long jump", "high jump"],
  }),
);
full.push(
  fromRule(rules.speed, {
    id: "travel-pace",
    term: "Travel Pace",
    category: "movement",
    heading: "Travel Pace",
    short: "Fast 4 miles an hour, normal 3, slow 2. A fast pace penalizes passive Perception.",
    related: ["vision-and-light"],
    aliases: ["pace", "forced march"],
  }),
);
full.push(
  fromRule(rules["vision-and-light"], {
    id: "vision-and-light",
    term: "Vision & Light",
    category: "movement",
    short: "Dim light is lightly obscured. Darkness is heavily obscured. Darkvision treats darkness as dim light.",
    aliases: ["dark", "darkvision", "light"],
  }),
);
full.push(
  fromRule(rules.resting, {
    id: "resting",
    term: "Resting",
    category: "movement",
    text: restingBits,
    short: "A short rest is 1 hour. A long rest is 8 hours and restores all hit points, once per day.",
    related: ["exhaustion"],
    aliases: ["short rest", "long rest"],
  }),
);

full.push(fromRule(rules.falling, { id: "falling", term: "Falling", category: "hazards", related: ["prone"] }));
full.push(
  fromRule(rules.suffocating, {
    id: "suffocating",
    term: "Suffocating",
    category: "hazards",
    aliases: ["holding breath", "drowning"],
  }),
);
full.push(
  written({
    id: "burning",
    term: "Burning",
    category: "hazards",
    short: "In 2014, burning depends on the source. Alchemist's fire is 1d4 fire at the start of each turn.",
    body: "In the 2014 rules, what burning does depends on the source. Alchemist's fire deals 1d4 fire damage at the start of each of the target's turns. A creature can use its action to make a DC 10 Dexterity check to put that fire out.",
  }),
);
full.push(
  written({
    id: "extreme-cold",
    term: "Extreme Cold",
    category: "hazards",
    short: "Constitution save DC 10 each hour or gain 1 exhaustion. Cold protection succeeds automatically.",
    body: "At 0 degrees Fahrenheit or colder, a creature makes a DC 10 Constitution saving throw at the end of each hour or gains 1 level of exhaustion. A creature with resistance or immunity to cold damage, or wearing cold-weather gear, succeeds automatically.",
    related: ["exhaustion"],
    aliases: ["cold", "freezing"],
  }),
);
full.push(
  written({
    id: "extreme-heat",
    term: "Extreme Heat",
    category: "hazards",
    short: "Without water, a Constitution save each hour, DC 5 and rising, or gain 1 exhaustion.",
    body: "At 100 degrees Fahrenheit or hotter, a creature without water makes a Constitution saving throw at the end of each hour or gains 1 level of exhaustion. The DC starts at 5 and rises by 1 each hour. Medium or heavy armor, or heavy clothing, imposes disadvantage. Resistance or immunity to fire damage succeeds automatically.",
    related: ["exhaustion"],
    aliases: ["heat"],
  }),
);
full.push(
  written({
    id: "frigid-water",
    term: "Frigid Water",
    category: "hazards",
    short: "Safe for a number of minutes equal to your Constitution score, then a DC 10 save each minute.",
    body: "A creature can be immersed in frigid water for a number of minutes equal to its Constitution score. After that, it makes a DC 10 Constitution saving throw each minute or gains 1 level of exhaustion.",
    related: ["exhaustion", "suffocating"],
    aliases: ["freezing water"],
  }),
);
full.push(
  written({
    id: "high-altitude",
    term: "High Altitude",
    category: "hazards",
    short: "Above 10,000 feet, each hour of travel counts as two toward the day's limit.",
    body: "At altitudes above 10,000 feet, each hour spent traveling counts as 2 hours toward the limit on how long the party can travel in a day, unless a creature is acclimated to high altitude.",
    related: ["travel-pace", "exhaustion"],
    aliases: ["altitude", "mountain"],
  }),
);
full.push(
  written({
    id: "weather",
    term: "Weather",
    category: "hazards",
    short: "Strong wind, heavy precipitation, and fog hinder ranged attacks, Perception, or both.",
    body: "Strong wind imposes disadvantage on ranged weapon attacks and can extinguish open flames. Heavy precipitation imposes disadvantage on Wisdom (Perception) checks that rely on hearing or sight and extinguishes open flames. Fog and other heavy obscurement can heavily obscure the area.",
    related: ["vision-and-light"],
    aliases: ["wind", "fog", "rain"],
  }),
);
full.push(
  fromRule(rules["food-and-water"], {
    id: "food-and-water",
    term: "Food & Water",
    category: "hazards",
    related: ["exhaustion"],
    aliases: ["starvation", "thirst"],
  }),
);
full.push(
  written({
    id: "improvised-damage",
    term: "Improvised Damage",
    category: "hazards",
    short: "Setback is about 1d10, dangerous 2d10–4d10, deadly 10d10, catastrophic 18d10–24d10.",
    body: "When something hurts a creature and no rule names the damage, pick a tier and stay consistent.",
    table: {
      columns: ["Tier", "Damage", "For example"],
      rows: [
        ["Setback", "1d10", "A splash of scalding water"],
        ["Dangerous", "2d10–4d10", "A short fall onto jagged stone"],
        ["Deadly", "10d10", "A collapsing ceiling in a small room"],
        ["Catastrophic", "18d10–24d10", "Being caught in a collapsing fortress"],
      ],
    },
    related: ["traps", "falling"],
  }),
);

const resistance = fromRule(rules["damage-resistance-and-vulnerability"], {
  id: "damage-types",
  term: "Damage Types & Resistance",
  category: "hazards",
  short: "Resistance halves damage, vulnerability doubles it, and immunity reduces it to zero.",
  aliases: ["resistance", "vulnerability", "immunity"],
});
resistance.body = `${resistance.body}\n\n**Damage types:** ${typeNames.join(", ")}.`;
full.push(resistance);

const traps = fromRule(rules["traps-in-play"], {
  id: "traps",
  term: "Traps",
  category: "hazards",
  text: asText(rules["traps-in-play"].desc).split("##### Trap Save")[0] ?? "",
  short: "Pick a severity, then use the party's level to size the save, the attack, and the damage.",
  related: ["improvised-damage", "typical-dcs"],
});
delete traps.table;
traps.table = mergeTrapTable(trapSplit.tables);
full.push(traps);

full.push(
  fromRule(rules["statistics-for-objects"], {
    id: "object-ac",
    term: "Object AC",
    category: "rulings",
    text: objectSplit[0],
    short: "Cloth 11, glass 13, wood 15, stone 17, steel 19, mithral 21, adamantine 23.",
    related: ["object-hp"],
  }),
);
full.push(
  fromRule(rules["statistics-for-objects"], {
    id: "object-hp",
    term: "Object HP",
    category: "rulings",
    text: `***Hit Points.***${objectSplit[1]}`,
    short: "Fragile to resilient: tiny 2/5, small 3/10, medium 4/18, large 5/27.",
    related: ["object-ac"],
  }),
);
full.push(
  fromRule(rules["advantage-and-disadvantage"], {
    id: "advantage",
    term: "Advantage & Disadvantage",
    category: "rulings",
    short: "Roll a second d20. Advantage uses the higher die, disadvantage the lower. They don't stack.",
    aliases: ["advantage", "disadvantage"],
  }),
);
full.push(
  fromRule(rules["passive-checks"], {
    id: "passive-checks",
    term: "Passive Checks",
    category: "rulings",
    short: "A passive check is 10 + the modifier. Advantage adds 5 and disadvantage subtracts 5.",
    aliases: ["passive perception", "passive"],
  }),
);
full.push(
  fromRule(rules["working-together"], {
    id: "group-checks",
    term: "Group Checks",
    category: "rulings",
    heading: "Group Checks",
    related: ["advantage"],
    aliases: ["group check"],
  }),
);
full.push(
  fromRule(rules.contests, {
    id: "contests",
    term: "Contests",
    category: "rulings",
    related: ["grappling-and-shoving"],
    aliases: ["opposed", "contest"],
  }),
);
full.push(
  fromRule(rules.skills, {
    id: "skills",
    term: "Skills by Ability",
    category: "rulings",
    short: "Strength has Athletics. Dexterity has Acrobatics, Sleight of Hand, and Stealth.",
    related: ["ability-checks-note"],
  }),
);
full[full.length - 1].related = ["advantage"];
for (const skill of ["Athletics", "Stealth", "Perception", "Persuasion"]) {
  if (!full[full.length - 1].body.includes(skill)) {
    throw new Error(`Skills entry is missing ${skill}`);
  }
}

const conditionEntries = REQUIRED_CONDITIONS.map((id) => {
  const raw = conditions[id];
  const { body, table } = conditionBody(raw.desc);
  const next = entry({
    id,
    term: raw.name,
    category: "conditions",
    short: CONDITION_SHORTS[id],
    body,
  });
  if (table) next.table = table;
  if (id === "grappled") {
    next.aliases = ["grab"];
    next.related = ["grappling-and-shoving", "restrained"];
  }
  if (id === "prone") next.related = ["movement", "falling"];
  if (id === "restrained") next.related = ["grappled"];
  if (id === "exhaustion") next.related = ["food-and-water", "resting"];
  if (id === "unconscious") next.related = ["dropping-to-0-hp"];
  return next;
});

const concentration = fromRule(rules.duration, {
  id: "concentration",
  term: "Concentration",
  category: "conditions",
  heading: "Concentration",
  short: "When it takes damage, Con save DC 10 or half the damage, whichever is higher.",
  related: ["incapacitated", "dropping-to-0-hp"],
  aliases: ["concentrating"],
});

function brief(id, term, fullId, short, body) {
  return entry({
    id,
    term,
    category: "start",
    short,
    body,
    related: [fullId],
  });
}

const start = [
  entries[0],
  brief(
    "typical-dcs-brief",
    "Typical DCs",
    "typical-dcs",
    "5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible.",
    "Pick the DC by how hard the task would be for a competent, ordinary person. The full table is under Rulings.",
  ),
  brief(
    "combat-flow-brief",
    "Combat Flow",
    "combat-flow",
    "Determine surprise, place combatants, roll initiative, then take turns until the fight ends.",
    "1. Determine surprise.\n2. Place the combatants.\n3. Roll initiative.\n4. Take turns in order.\n5. Repeat until the fight ends.",
  ),
  brief(
    "your-turn-brief",
    "Your Turn",
    "your-turn",
    "Move, one action, a bonus action only if something grants it, and one free object interaction.",
    "On a turn: move up to your speed, take one action, take a bonus action only if a feature grants one, and interact with one object for free. One reaction per round.",
  ),
  brief(
    "skills-brief",
    "Skills by Ability",
    "skills",
    "Strength has Athletics. Dexterity has Acrobatics, Sleight of Hand, and Stealth.",
    "**Strength:** Athletics\n\n**Dexterity:** Acrobatics, Sleight of Hand, Stealth\n\n**Constitution:** none\n\n**Intelligence:** Arcana, History, Investigation, Nature, Religion\n\n**Wisdom:** Animal Handling, Insight, Medicine, Perception, Survival\n\n**Charisma:** Deception, Intimidation, Performance, Persuasion",
  ),
  brief(
    "advantage-brief",
    "Advantage & Disadvantage",
    "advantage",
    "Roll a second d20. Advantage uses the higher die, disadvantage the lower. They don't stack.",
    "Roll a second d20. Use the higher result for advantage and the lower result for disadvantage. Extra dice don't stack, and advantage cancels disadvantage.",
  ),
];

const byCategory = {
  start,
  conditions: [...conditionEntries, concentration],
  combat: full.filter((item) => item.category === "combat"),
  movement: full.filter((item) => item.category === "movement"),
  hazards: full.filter((item) => item.category === "hazards"),
  rulings: full.filter((item) => item.category === "rulings"),
};

const ordered = [
  ...byCategory.start,
  ...byCategory.conditions,
  ...byCategory.combat,
  ...byCategory.movement,
  ...byCategory.hazards,
  ...byCategory.rulings,
];

const ids = new Set();
for (const item of ordered) {
  if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}`);
  ids.add(item.id);
  for (const related of item.related ?? []) {
    if (!ordered.some((other) => other.id === related)) {
      throw new Error(`${item.id} relates to missing ${related}`);
    }
  }
}

const out = join(ROOT, "src/data/dm-reference.json");
writeFileSync(out, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`Wrote ${ordered.length} entries to ${out}`);
