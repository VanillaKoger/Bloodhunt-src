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

The game opens in the Haven, a walled courtyard of its own. Walk up to a station and press its prompt (or E / Enter):

- **Night Gate** (north wall): pick a district and a danger (I–V), and step through. Each danger shows its three marks; clearing them opens the next danger. The Mob District opens once the Slums marks at Danger III are cleared and the Rat King has fallen five times. Tonight's Omen, one extra objective a day, sits at the top.
- **Range** (west wall): three practice dummies, bare, mailed (12 armor), and plated (30 armor). They never fall. Each shows a live DPS readout (the last 5 seconds), the total, and the top hit, and the reading starts over after a few seconds without a hit. Weapons, swings, and all four blood powers work on them, Blood Drain included.
- **Blood Altar**: blood powers and rites (Vitae).
- **Armory**: the gear and weapons menu.
- **The works** (east and south sides): Bone Forge (+1.5% weapon damage a level), Blood Font (+2% max HP), Bile Still (+2% skill damage), Brass Coffer (+2% Blood from kills), and Ossuary (+0.4% crit). Each runs to level 30, and the late levels cost far more than the early ones.
- **Wardrobe**: cape dyes, eye glows, and strike trails. Buy one once, then wear it whenever you like.

A night lasts 5:00 before dawn. Everything picked up is carried, and only banks by standing in a way out (a pillar of light; the HUD marker points to the nearest) until it fills. Falling, abandoning, or being caught by the sun keeps 25% of the haul (more with the Blood Pact rite). Killing quickly builds Frenzy, a Blood multiplier. Extracting or falling brings the hero back to the Haven.

Three currencies, each for one side of the hero:

- **Blood** (every kill): gear levels, in the Armory.
- **Ichor** (elites and bosses): weapon tiers, the Ascend button on the weapon slot. Each tier also needs the weapon level it starts at.
- **Vitae** (extracting, and bosses): blood powers (skill damage and cooldown) and Haven rites (longer nights, Blood Pact, Frenzy cap, elite chance, offline thralls).

And three materials, carried and banked the same way, for the works and the wardrobe:

- **Bone**: plague hounds and skeletons.
- **Bile**: plague walkers, feral thralls, and the miasma.
- **Brass**: thugs and enforcers.

Elites drop double, and the Rat King and the Don drop a pile of each. Spending happens only at the Haven. A reload mid-night resumes it. Rules and numbers live in `src/game/nights.ts` (the night) and `src/game/haven.ts` (the yard, works, and wardrobe). `?enemies=1` still starts a Slums night at load for test runs.

## The climb

The climb to peak is paced for six to eight months of one sitting a day (about four nights). Every gain is small. New dangers and the Mob District open through marks: several runs at a danger plus two bonus objectives done in a single night, counted only when you get out. `PROGRESSION.md` has the curves and the timeline, and `npm run pacing` replays the climb on the current numbers.

## The Slums

Enemies stand in pods at nine fixed spots across the three courts and the alleys between them. A pod wakes when the hero comes within 24 m, rolls one of its mixes, and keeps to its spot until one of them sees the hero or is hit; then the whole pod hunts together. A wiped pod comes back 28–45 seconds later with a fresh roll. From Danger III a pod brings one more of its lead. The roster is plague hounds (fast, in packs), plague walkers, feral thralls, the miasma (stands off and spits bile), mob thugs who came down from the district, and now and then a few skeletons. The Rat King, a bloated plague lord with a crown, holds court in the chapel yard. See `ENEMY-STATS.md` for numbers and the pod list.
