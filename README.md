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

- **Night Gate** (north wall): pick one of the ten maps and one of its three zones, and step through. Each zone shows its three marks; clearing them opens the next zone, and clearing the last zone (and felling its boss a few times) opens the next map. Tonight's Omen, one extra objective a day, sits at the top.
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

## Combat

The hero still auto-attacks whatever is in reach, and Dash and the attack work as before. What changed is the other side of the fight (rules in `src/game/combat.ts`, ground markers in `src/game/telegraph.ts`):

- **No knockback. Poise instead.** Hits rock an enemy in place and fill a gold strip under its health bar. A full strip staggers it: it is stunned where it stands (a gold halo), takes 35% more damage, and a kill while it is stunned is a **Feed** that heals 6% of max HP and adds a Frenzy stack. Heavier weapons (the Mace) and Crimson Nova fill the strip fastest. Poise drains back after a breather. Bosses get harder to stagger each time.
- **Every enemy attack is marked on the ground.** Gold is a plain swing: it tracks you for the first half of its wind-up, then commits, so stepping out of the wedge makes it miss, and staggering the enemy cancels it. Red is an ability: nothing cancels it, so step out of the area. A red mark at the screen's edge points at an ability winding up out of view.
- **Two at a time.** Only two enemies close in and swing at once. The rest circle you and wait their turn, and still use their abilities. One red ability winds up at a time (two from tier 16), with a short gap between them that narrows down the ladder.
- **Regen waits out the fight.** Natural regen starts 3.5 s after the last hit taken. Lifesteal, Blood Drain, and Feeds still heal mid-fight.

One ability per enemy:

| Enemy | Ability |
| --- | --- |
| Plague Hound | **Flank Lunge**: circles to your side or back (it gives ground when faced), then leaps down a red lane. |
| Plague Walker | **Bile Retch**: a red cone of bile that leaves a burning green pool. |
| Feral Thrall | **Pounce**: from range, leaps onto a red ring where you are heading, then stands winded (double poise damage). |
| Miasma | **Acid Lob**: arcs a glob onto a red ring where you are heading, leaving an acid pool. Its plain attack is a bolt down a gold lane. |
| Skeleton | **Reassemble**: falls into a bone pile and stands again at half HP unless you strike the pile within 3 s. One that dies staggered stays down. |
| Mob Thug | **Haymaker Charge**: backs off, then charges down a red lane and stands dazed (double poise damage). |
| Enforcer | **Bulwark**: his shield takes 75% of hits to his front, and most of their poise. Hit his side or back, or hit him while he swings. |

**Elites** roll one modifier (two from tier 11), named over their health bar, with the ring in the first one's color: Frenzied (faster), Ironhide (hard to stagger, takes 15% less), Volatile (bursts in a red ring on death, from tier 3), Vampiric (heals from its hits, from tier 5), Warded (a ward soaks 35% of its HP and blocks staggers until it breaks, from tier 8), Shadowed (blinks behind you, from tier 11), and Packleader (allies within 6 m hit 25% harder and move faster, from tier 14). Tiers count the ladder's 30 zones from 1, as in `PROGRESSION.md`.

**Bosses** fight in three phases. From the start: a telegraphed swing and the red pound. At 60% HP: they call help and add their own move. At 30%: enraged, faster, and the pound lands three times in a row on wherever you stand.

| Boss | Own move |
| --- | --- |
| The Rat King | Leaps for your flank |
| The Don | Charges down a lane |
| The Harbormaster | Hurls three anchors where you are heading |
| The Ringmaster | Throws a fan of five knives |
| The Alpha | Pounces from range |
| The Gravelord | Opens five graves around you |
| The Countess | Steps out of the shadow behind you |
| The Inquisitor | Calls three bars of dawn across the ground |
| The Bone Colossus | Slams a long lane of bone |
| The Elder | Bursts with blood all around |

The Haven's range dummies stagger too, so the yard shows how fast each weapon breaks poise.

## On a phone

- **Moving:** hold a thumb anywhere on the left of the screen. A faint stick shows where to start, and the stick follows the thumb if it drifts far.
- **View distance:** pinch, or tap the view button under the mute button (Close / Normal / Far / Farthest). The camera always stays centered on the hero. A tall phone screen starts a little farther out so the sides of the street stay in view. The choice is saved. On desktop the mouse wheel does the same.
- **Menus:** the Haven board, the gear menu, and the night summary all scroll with a finger. A drag that starts on a button scrolls the menu and never presses the button. The board's title and tabs stay at the top while its list scrolls.

## The climb

The climb is paced for eight to ten months of one 30-minute sitting a day: every map cleared around month 8, peak power around month 9. Every gain is small. New zones and maps open through marks: several runs in a zone plus two bonus objectives done in a single night, counted only when you get out. `PROGRESSION.md` has the curves, the 30-tier ladder, and the timeline, and `npm run pacing` replays the climb on the current numbers.

## The maps

Ten maps, three zones each, one zone a night: the Slums, the Mob District, the Black Docks, the Night Market, the Blackwood, Hollow Graves, Ashen Manor, the Cathedral of Dawn, the Deep Catacombs, and the Crimson Spire. Each has its own theme, its own tinted roster, and a boss in its last zone. The Slums and the Mob District's square are hand-built; the rest are placeholder layouts and art (`src/game/maps.ts`, `src/game/mapart.ts`) waiting on real assets.

## The Slums

The Slums' three zones are its three courts: the Court in the middle, the Bone Yard down the south alley, and the Chapel Yard up the north alley. Enemies stand in pods at fixed spots in each, four per zone. A pod wakes when the hero comes within 24 m, rolls one of its mixes, and keeps to its spot until one of them sees the hero or is hit; then the whole pod hunts together. A wiped pod comes back 24–34 seconds later with a fresh roll. The roster is plague hounds (fast, in packs), plague walkers, feral thralls, the miasma (stands off and spits bile), mob thugs who came down from the district, and now and then a few skeletons. The Rat King, a bloated plague lord with a crown, holds court in the chapel yard. See `ENEMY-STATS.md` for numbers and the pod list.
