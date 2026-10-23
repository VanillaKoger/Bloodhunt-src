# Progression

The climb to peak power is built to take **six to eight months of one sitting a day**. A sitting here means about four nights (25–30 minutes), plus the thralls' offline trickle overnight. Every gain is a small step: a gear level late in the climb adds under 1% damage, and a work level adds 1–1.5%.

Peak means every one of these is done:

- Hero level 60
- All four gear slots at level 50
- The Immortal weapon tier at its last rank (12)
- All four blood powers at rank 10, and every rite at its last rank
- All five works at level 30
- All 30 marks in both districts

After peak, new endgame loops go on top.

## How long, by sitting

`npm run pacing` plays the climb on the real numbers and prints the day each milestone lands (`npm run pacing -- 3` for three nights a day). The fight is modeled (time to kill, damage taken per pod, odds of falling), so treat the days as targets to check against playtests, not promises.

| Milestone | 4 nights a day |
| --- | --- |
| Slums Danger II | day 1 |
| Slums Danger III | day 3 |
| Kindred tier | day 8 |
| Mob District opens (with Slums IV) | day 12 |
| Mob Danger III | day 30 |
| Awakened tier | day 46 |
| Slums V, Mob IV | day 62–63 |
| Ascendent tier | day 111 |
| Mob Danger V | day 126 |
| Works maxed | day 153 |
| Rites maxed | day 156 |
| Immortal tier | day 174 |
| Powers maxed | day 175 |
| Level 60 | day 178 |
| Every mark | day 181 |
| All gear 50 | day 214 |
| **Peak** | **day 227** |

At three nights a day peak lands near day 300. At five, near day 185.

## Opening the way: marks

Each danger of each district has three marks, shown on the district card at the Night Gate. The first is always "get out N times at this danger", so every step takes several runs. The other two are bonus objectives for a single night:

- Slay N in one night
- Slay N elites in one night
- Slay the district boss (the Rat King, or the Don)
- Get out carrying N Blood
- Get out never below 50% HP
- Wipe out N pods in one night (the Slums)
- Reach full Frenzy
- Slay N before 3:00

A mark only counts when the hero gets out. A toast calls a one-night mark the moment it is met, as a reminder to reach a way out. Clearing all three marks of a danger opens the next one, and each mark pays once in Vitae, Ichor, Bone, Bile, and Brass (more for deeper dangers and in the Mob District). The marks and their counts are in `src/game/marks.ts`.

| Danger | The Slums | The Mob District |
| --- | --- | --- |
| I | Get out ×3 · Slay 30 · Carry 300 Blood | Get out ×4 · The Don · Slay 40 |
| II | Get out ×8 · The Rat King · 3 elites | Get out ×6 · 4 elites · Slay 55 |
| III | Get out ×8 · 10 pods · Unbroken | Get out ×9 · The Don · Unbroken |
| IV | Get out ×12 · The Rat King · Full Frenzy | Get out ×13 · Full Frenzy · 6 elites |
| V | Get out ×16 · 6 elites · Slay 36 before 3:00 | Get out ×18 · The Don · Slay 38 before 3:00 |

The Mob District opens when the Slums marks at Danger III are cleared and the Rat King has fallen five times. Its first danger is about as hard as the Slums at III, and its fifth is the hardest fight in the game.

### The Omen

One extra objective a day, the same all day and new at local midnight. It counts in any district at that district's highest open danger or the one below, and pays Vitae, Ichor, and all three materials, scaled to the deepest danger opened. It is there for the hunter who comes back each night.

## Dangers

Enemies grow by steps (see `ENEMY-STATS.md`), and each danger also multiplies their damage (bite) and HP (tough) directly, so a deeper danger hurts more than the steps alone.

| Danger | Steps | Blood | Bite | Tough | Elites | Materials | Vitae on extract |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I | 0 | ×1 | ×1 | ×1 | 5% | ×1 | 1 |
| II | 10 | ×1.3 | ×1.35 | ×1.2 | 6% | ×1.3 | 2 |
| III | 24 | ×1.7 | ×1.9 | ×1.5 | 7% | ×1.6 | 3 |
| IV | 42 | ×2.2 | ×2.7 | ×1.9 | 8% | ×2 | 4 |
| V | 64 | ×2.8 | ×3.8 | ×2.4 | 9% | ×2.5 | 6 |

The Mob District adds 22 steps, ×1.35 Blood, ×1.4 bite, and ×1.25 tough on top. Enemies gain only 2% XP and Blood per step, so most of a deeper night's pay comes from the danger multiplier itself. The Slums drop Bone and Bile; the Mob District drops Brass. The works need all three, so the climb keeps coming back to the Slums.

## Costs

| What | Paid with | Curve |
| --- | --- | --- |
| Hero level | XP | 30 + 18 × level^1.95 (48 for level 2, ~51,000 for level 60). Capped at 60. |
| Gear level | Blood | 11.5 × level^2.35 (12 for level 2, ~108,000 for level 50). About 1.6 million Blood a slot. |
| Weapon tier | Ichor, plus the weapon level it starts at | Kindred 60 (level 10), Awakened 240 (20), Ascendent 640 (32), Immortal 1,500 (44) |
| Weapon rank | Kills with the weapon | Tier kills × (1 + rank × 0.5): Immortal needs 340, 510, 680… |
| Blood power rank | Vitae | 6, 14, 25, 40, 59, 81, 107, 136, 169, 206 (843 a power) |
| Rite rank | Vitae | Long Night, Blood Pact, Ichor Scent: 11 → 177 over six ranks. Frenzy 14 → 170 over five. Thrall Master 9 → 109 over five. |
| Work level | Materials (the Font also takes Blood) | Base × (level + 1)^1.6: the Bone Forge goes from 4 Bone + 3 Brass to 924 + 693 |

## What each step is worth

- Hero level: one attribute point, and +1 Fortitude and Resistance.
- Attribute point: +0.6 damage (Might), +1.5% damage with that weapon type (mastery), +4 HP, +0.25 HP/s, +3% speed, +0.2% lifesteal, +1.5% Blood, or −0.7% damage taken.
- Gear level: weapon +2 Strength, +0.5 Vitality, +0.5 flat damage; coat +2 Fortitude, +1.5 Vitality, +2.5 HP, +0.5 armor; cape +1.5 Sorcery, +1 Resistance, +2% skill damage; boots +2 Agility, +0.5 Fortitude.
- Weapon tier: ×1.00, ×1.08, ×1.20, ×1.35, ×1.52 damage, plus 1.5–1.8% a rank.
- Blood power rank: +5% skill damage, −2% cooldown.
- Rites: Long Night +15 s, Blood Pact +5% kept on a loss, Frenzy +2 stacks, Ichor Scent +0.5% elite chance, Thrall Master +20% offline.
- Works: Bone Forge +1% weapon damage, Blood Font +1.5% HP, Bile Still +1.5% skill damage, Brass Coffer +1.5% Blood, Ossuary +0.2% crit.
- Feeding: every kill adds a stack to its stat, giving up to +60, half of that by about 6,000 feeds of one stat.
- Frenzy: +5% Blood a stack.
- Lifesteal is capped at 12%.
- Bosses grow 3% HP a fall for their first twenty falls; the danger does the rest.
- Offline thralls: 6 feeds an hour for up to 8 hours (+20% a Thrall Master rank), paid at the Slums' deepest open danger.

## Tuning

Every number above lives in code: `src/game/balance.ts` (levels, gear, tiers, stacks, enemies), `src/game/nights.ts` (dangers, districts, Ichor, Vitae, powers, rites), `src/game/haven.ts` (works), and `src/game/marks.ts` (marks, the Omen, the Mob District gate). Change one, run `npm run pacing`, and check the peak still lands between day 180 and day 245 at four nights a day.
