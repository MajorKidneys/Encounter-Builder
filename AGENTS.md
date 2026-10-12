<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Encounter data lives in browser localStorage via `src/lib/encounters.ts` (no backend in V1 by user request).
- The root Workspace owns encounter and spell-list state and the shared sidebar; leaf routes render only their panes so navigation preserves selection and avoids competing localStorage writers.

- Monster library is static JSON lazy-loaded via `src/lib/monsters.ts`: `src/data/srd-monsters.json` (SRD 5.1, CC-BY-4.0) plus `src/data/a5e-monsters.json` (EN Publishing Monstrous Menagerie, OGL 1.0a, from Open5e document key `a5e-mm`; A5E entries carry `source: "Monstrous Menagerie"` and `srd: false`). Imported/edited stats live on the combatant in localStorage — keeps the bundle small and library read-only. Kobold Press books were deliberately excluded (user balance concern).

- Render unsaved custom stats through the same form as imported stats and persist only on edits; opening or collapsing the panel must not change existing HP or encounter data.
- The monster search/preview lightbox lives in `src/components/MonsterImportDialog.tsx` (with `DescriptionSection.tsx`) and is shared by the creature panel and the encounter table; turning a library entry into an initiative row goes through `combatantFromLibrary` in `src/lib/equipment.ts` so native gear and AC install identically from either entry point.
- Monster descriptions are optional bundled library text copied on import; older imported creatures read a library fallback without writing encounter data, and only explicit description edits persist an override.
- Equipment rules are bundled locally and synchronized through `src/lib/equipment.ts`; loot IDs link attacks to gear, printed native attacks stay untouched, and calculated snapshots preserve DM overrides.
- SRD magic items are static JSON in `src/data/magic-items.json`, lazy-loaded; loot items snapshot their bonus/AC/Strength effects so stat math never needs the list.
- SRD spells are static JSON in `src/data/srd-spells.json`, lazy-loaded via `src/lib/spells.ts`; monster spellcasting stores structured entries/slots on the combatant, and the Spell Book page (`/spells`) holds full details plus localStorage named lists — keeps the creature panel short.

- macOS desktop build: `electron/main.cjs` serves `dist/client` from a fixed local port (127.0.0.1:47615) instead of file:// — file:// blocks module scripts and a fixed origin keeps localStorage stable across launches. Package on Linux with electron-packager (no spaces in the app name); strip every Mach-O's existing signature first (rcodesign inherits the hardened-runtime flag, and ad-hoc + hardened runtime makes macOS kill the app over "different Team IDs"), then ad-hoc sign the whole bundle with `rcodesign sign` and no runtime flag. Pass `--icon=electron/icon/icon.icns` to electron-packager for the app icon (SVG source in `electron/icon/`). Zip only the `.app` at the archive root with `zip -ry` so framework symlinks survive — otherwise macOS reports the app as "damaged".

- Visual system: oxblood/pale-grey/bronze/teal/amber/wine palette as oklch tokens in `src/styles.css` (wine = turn, lists, primary actions; teal = healthy HP, heal, stat sources; gold = concentration, hold, bloodied; bronze = `label-caps` section labels). Dark mode follows the OS via `prefers-color-scheme`. Fonts (Bricolage Grotesque, Instrument Sans, JetBrains Mono) are bundled in `public/fonts` so the desktop app works offline.
- Turn tracking lives in `src/lib/turns.ts` as pure functions over an Encounter (`round`, `turnId`, combatant `held`, nullable `init`); conditions are stored per copy on `Unit.conditions` and count down when that creature's turn ends, so a 1-round condition lasts through the turn they take. Previous turn restores the last `turnHistory` entry (conditions, turn/round resources, hold, and Act now) and does not apply those effects again. Keep the logic there and covered by `turns.test.ts`.
- A combatant's display `name` is independent of `stats.name` (the library monster its stats came from); the list and drawer show the source when they differ.
- Drawer sections collapse with chevrons; open/closed state is a UI preference in `dm-drawer-sections-v1`, never written to encounter data.
