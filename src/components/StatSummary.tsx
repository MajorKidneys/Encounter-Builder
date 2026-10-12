import type { Feature, MonsterStats } from "@/lib/monsters";
import { crLabel, mod } from "@/lib/monsters";

const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const XP: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

/** Read-only, play-first view of a stat block: the numbers the DM looks for mid-fight, then actions. */
export function StatSummary({ s }: { s: MonsterStats }) {
  const cr = crLabel(s.cr);
  const props: [string, string][] = (
    [
      ["Saves", s.saves],
      ["Skills", s.skills],
      ["Vulnerable", s.vuln],
      ["Resist", s.resist],
      ["Immune", [s.immune, s.condImmune].filter(Boolean).join(" · ")],
      ["Senses", [s.senses, `passive Perception ${s.passive}`].filter(Boolean).join(", ")],
      ["Languages", s.languages || "—"],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const speed = s.speed.match(/^(\d+)\s*ft\.?(.*)$/);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border bg-card">
        {[
          ["AC", String(s.ac), s.acNote],
          ["HP", String(s.hp), s.hitDice],
          [
            "Speed",
            speed ? speed[1]! : s.speed,
            speed ? `feet${speed[2] ? `,${speed[2]}` : ""}` : "",
          ],
          ["CR", cr, XP[cr] ? `${XP[cr]!.toLocaleString()} XP` : ""],
        ].map(([k, v, sub], i) => (
          <div
            key={k}
            className={
              i
                ? "grid content-start gap-px border-l border-border px-3 py-2.5"
                : "grid content-start gap-px px-3 py-2.5"
            }
          >
            <span className="label-caps text-[9.5px]">{k}</span>
            <b className="font-mono text-xl font-semibold leading-tight tabular">{v}</b>
            {sub && <span className="text-[11.5px] leading-snug text-muted-foreground">{sub}</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ABS.map((a, i) => (
          <div key={a} className="grid justify-items-center gap-px rounded-lg bg-secondary py-2">
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{a}</span>
            <b className="font-mono text-base font-semibold tabular">{mod(s.abilities[i])}</b>
            <span className="font-mono text-[11px] text-muted-foreground tabular">
              {s.abilities[i]}
            </span>
          </div>
        ))}
      </div>
      {props.length > 0 && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3.5 gap-y-1.5 text-[13.5px]">
          {props.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <Features title="Actions" items={s.actions} attacks />
      <Features title="Legendary actions" items={s.legendary} attacks />
      <Features title="Reactions" items={s.reactions} />
      <Features title="Traits" items={s.special} />
    </div>
  );
}

function Features({
  title,
  items,
  attacks,
}: {
  title: string;
  items: Feature[];
  attacks?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="grid gap-2">
      <h4 className="label-caps border-b border-border pb-1.5">{title}</h4>
      {items.map((f, i) => {
        const hit = f.calculatedAttack ?? f.attack;
        const dmg = f.calculatedDamage ?? f.damage;
        return (
          <p key={i} className="text-[13.5px] leading-relaxed">
            <b className="font-semibold">{f.name}.</b>{" "}
            {attacks && hit !== undefined && (
              <span className="mr-1 whitespace-nowrap rounded bg-primary/15 px-1.5 py-px font-mono text-[11.5px] font-semibold text-wine-ink">
                {hit >= 0 ? "+" : ""}
                {hit} to hit
              </span>
            )}
            {attacks && dmg && (
              <span className="mr-1 whitespace-nowrap font-mono text-xs">{dmg}</span>
            )}
            <span className="text-muted-foreground">{f.desc}</span>
          </p>
        );
      })}
    </div>
  );
}
