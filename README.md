# Blood-hunt: Eternal Thirst (source mirror)

Private coding source for Claude Cloud / external agents.

- **Source of truth (Cursor Origin):** `devon-bosom/tmp-f762bdcefbb45f37`
- **Playtest / GitHub Pages (built site only):** https://github.com/VanillaKoger/Bloodhunt — leave untouched

This mirror holds the TypeScript under `src/`, configs, scripts, and the free `public/` asset packs the game loads at runtime (KayKit / Kenney / Quaternius CC0, plus Atomic Realm FREE Starter apocalypse props). See `CREDITS.md` and `public/kenney/PACKS.txt`.

Asset trees were restored from the Pages build's `cc0/` and `kenney/` (same free packs the game uses). Origin `git clone` auth was unavailable on this box; some non-runtime art sketches under `games/vampire-incremental/art/` may still be absent.

## Free weapon packs

- **KayKit Fantasy Weapons Bits 1.0 (FREE / CC0)** — full pack at `public/cc0/kaykit/weapons/` (`License.txt`, `Assets/gltf|fbx|fbx(unity)|obj`, `Textures/`). 31 glTF stems (arrows, axes, bows, daggers, fistweapons, halberd, hammers, shields, spear, staffs, swords, wand). At runtime each weapon class holds a different pack model per tier (Teethling → Immortal); see `TIER_MODELS` in `src/game/kaykit.ts`. The Teethling mace is `bone_A` from Halloween Bits.

## Free character / combat / movement animations

KayKit Character Animations 1.1 (FREE / CC0) — Rig_Medium sets:

- **Runtime (loaded by `src/game/kaykit.ts`):** `public/cc0/kaykit/anim-combat.glb`, `anim-general.glb`, `anim-move.glb`, plus `mage.glb` / `skeleton-minion.glb`
- **Additional free categories (cleaned clip names):** `anim-ranged.glb`, `anim-move-advanced.glb`, `anim-simulation.glb`, `anim-special.glb`, `anim-tools.glb`
- **Full free pack archive (Med_* with Rig_Medium| prefixes):** `public/cc0/kaykit/animations/` (+ `License.txt`, `NOTES.txt`)
- License copies: `public/cc0/kaykit/licenses/KayKit-Character-Animations.txt`

Kenney Animated Characters / Mixamo / Quaternius character-anim libraries were searched on disk and not vendored (see `animations/NOTES.txt`).

## The hunt loop

The game opens at the Haven. From there the hero picks a district (the Slums, or the Mob District once the Rat King has fallen) and a danger (I–V; extracting at one opens the next). A night lasts 5:00 before dawn. Everything picked up is carried, and only banks by standing in a way out (a pillar of light; the HUD marker points to the nearest) until it fills. Falling, abandoning, or being caught by the sun keeps 25% of the haul (more with the Blood Pact rite). Killing quickly builds Frenzy, a Blood multiplier.

Three currencies, each for one side of the hero:

- **Blood** (every kill): gear levels, in the Gear menu.
- **Ichor** (elites and bosses): weapon tiers, the Ascend button on the weapon slot. Each tier also needs the weapon level it starts at.
- **Vitae** (extracting, and bosses): blood powers (skill damage and cooldown) and Haven rites (longer nights, Blood Pact, Frenzy cap, elite chance, offline thralls).

Spending happens only at the Haven. A reload mid-night resumes it. Rules and numbers live in `src/game/nights.ts`. `?enemies=1` still starts a Slums night at load for test runs.
