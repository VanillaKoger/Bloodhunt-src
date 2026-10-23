# Progression

The climb to the top is built for **eight to ten months of one 30-minute sitting a day**. A sitting is about four or five nights (`npm run pacing` assumes 4.5), plus the thralls' offline trickle overnight. Every gain is a small step: a gear level late in the climb adds under 1% damage, and a work level adds 1–1.5%.

"Completing the game" means clearing all 90 marks, every zone of all ten maps. Peak power means that and:

- Hero level 60
- All four gear slots at level 50
- The Immortal weapon tier at its last rank (12)
- All four blood powers at rank 10, and every rite at its last rank
- All five works at level 30

New endgame loops go on top of that.

## How long, by sitting

`npm run pacing` plays the climb on the real numbers and prints the day each milestone lands (`npm run pacing -- 4` for four nights a day). The fight is modeled (time to kill, damage taken per pod, odds of falling), and who is fought in each zone comes from that zone's own pods, so treat the days as targets to check against playtests, not promises.

| Milestone | 4.5 nights a day (one 30-minute sitting) |
| --- | --- |
| The Mob District opens | day 4 |
| Kindred tier | day 9 |
| The Black Docks open | day 12 |
| The Night Market opens | day 25 |
| The Blackwood opens | day 40 |
| Awakened tier | day 48 |
| Hollow Graves open | day 58 |
| Ashen Manor opens | day 72 |
| Ascendent tier | day 125 |
| Cathedral of Dawn opens | day 130 |
| The Deep Catacombs open | day 172 |
| Works maxed | day 176 |
| Rites maxed | day 186 |
| The Crimson Spire opens | day 188 |
| Powers maxed | day 206 |
| Immortal tier | day 208 |
| Level 60 | day 214 |
| **Every map cleared (all 90 marks)** | **day 249, about 8.2 months** |
| All gear 50 | day 267 |
| **Peak** | **day 270, about 8.9 months** |

| Sitting | Every map cleared | Peak |
| --- | --- | --- |
| 4 nights a day | day 277 (about 9.1 months) | day 300 (about 9.9 months) |
| 4.5 nights a day | day 249 (about 8.2 months) | day 270 (about 8.9 months) |
| 5 nights a day | day 224 (about 7.4 months) | day 245 (about 8 months) |

The fight model follows the combat rules in `src/game/combat.ts`: two enemies swing at a time and the rest circle, a swing comes every cooldown plus its wind-up, most plain swings land but most red abilities are stepped out of, a share of the hero's damage lands on staggered enemies, regen waits out the fight while lifesteal and Feeds heal, and deeper pods bring one more of their lead from tier 11 and two from tier 21.

The whole length hangs on one knob, `PACE` in `src/game/pace.ts` (now 1.45). Every pacing cost (XP, gear Blood, tier Ichor, weapon-rank kills, power and rite Vitae, work materials, feeding) is multiplied by it.

## The maps

Ten maps, each with three zones. A night is fought in one zone: its own ground, its own pods, its own way out, with sealed gates toward the other zones. Zone 3 of every map holds the map's boss, called out once the night has made eight kills. The Slums and the Mob District's square are hand-built; every other zone is laid out from rectangles in `src/game/maps.ts` and dressed with placeholder art (themed floors, walls, gates, and primitive props) in `src/game/mapart.ts`, ready for real art.

| # | Map | Theme | Zones | Hunted there | Boss |
| --- | --- | --- | --- | --- | --- |
| 1 | The Slums | Plague tenements under a purple moon | The Court · The Bone Yard · The Chapel Yard | plague hounds, walkers, feral thralls, the miasma, skeletons, thugs | The Rat King |
| 2 | The Mob District | Neon, wet asphalt, and men in fedoras | The Square · The Back Lots · The Club | thugs, enforcers, guard dogs | The Don |
| 3 | The Black Docks | Fog off the black water, and smugglers | The Wharf · The Warehouses · The Drowned Pier | dockhands, the drowned, sea-fog, bruisers | The Harbormaster |
| 4 | The Night Market | Lanterns, masks, and a carnival that never closes | Lantern Row · The Stalls · The Big Top | strays, barkers, masked revelers, fire-eaters | The Ringmaster |
| 5 | The Blackwood | The forest past the city wall | The Treeline · The Hollow · The Wolf Den | wolves, bramble-walkers, wild ones, wisps | The Alpha |
| 6 | Hollow Graves | The city's great cemetery | The Lychgate · The Old Plots · The Mausoleum | grave dogs, ghouls, skeletons, wraiths | The Gravelord |
| 7 | Ashen Manor | A rival house of the old blood | The Gardens · The Long Halls · The Ballroom | bloodhounds, doormen, servants, bat clouds | The Countess |
| 8 | Cathedral of Dawn | The hunters' order, waiting for you | The Nave · The Cloister · The Reliquary | hunters, paladins, zealots, the choir | The Inquisitor |
| 9 | The Deep Catacombs | Under the city, bones to the ceiling | The Ossuary Stair · The Burial Halls · The Bone Throne | skeletons, the tomb-fed, the lost, stale air | The Bone Colossus |
| 10 | The Crimson Spire | The Elder's citadel, the top of the night | The Causeway · The Blood Gardens · The Elder's Throne | elder spawn, blood knights, the honored dead, blood wraiths | The Elder |

The creatures are the existing seven models, tinted per map and named per map, until the real ones arrive. The bosses past the Rat King and the Don are pack characters restyled by a few lines of look data (`boss.look` in `maps.ts`).

## Opening the way: marks

Every zone has three marks, shown on the map's card at the Night Gate. The first is always "get out N times in this zone", so every step takes several runs. The other two are bonus objectives for a single night, and the last zone's always includes the boss. Each map asks its own pair of objectives in its own order. A mark only counts when the hero gets out, and a toast calls a one-night mark the moment it is met.

- Clearing all three marks of a zone opens the next zone.
- A map opens when the map before it has its last zone's marks cleared and its boss has fallen a few times (three for the Rat King, four for the rest).
- Each mark pays once: Vitae, Ichor, and all three materials, from 3 Vitae, 2 Ichor, and 10 of each material in the Slums' Court to 32 Vitae, 37 Ichor, and 155 of each material on the Elder's Throne.

The Omen is one extra objective a day, the same all day and new at local midnight. It counts in any zone within three tiers of the deepest one open and pays more the deeper the hunter has gone.

## The ladder

The 30 zones are one ladder of tiers. Enemies grow by steps (see `ENEMY-STATS.md`), and each tier also multiplies their damage (bite) and HP (tough) directly. Bosses take bite to the power 0.75 (their own growth per step already makes them dangerous). Enemies gain only 2% XP and Blood a step, so most of a deeper night's pay comes from the tier's own Blood multiplier.

| Tier | Map | Zone | Steps | Bite | Tough | Blood | Elites | Materials | Vitae out | Marks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | The Slums | The Court | 0 | ×1 | ×1 | ×1 | 5% | ×1 | 1 | Get out 4 times · Slay 28 in one night · Get out carrying 300 Blood |
| 2 | The Slums | The Bone Yard | 4 | ×1.12 | ×1.08 | ×1.1 | 5% | ×1.06 | 1 | Get out 4 times · Slay 2 elites in one night · Wipe out 6 pods in one night |
| 3 | The Slums | The Chapel Yard | 7 | ×1.26 | ×1.16 | ×1.19 | 5% | ×1.12 | 1 | Get out 4 times · Slay the Rat King · Get out never below 50% HP |
| 4 | The Mob District | The Square | 11 | ×1.41 | ×1.24 | ×1.29 | 5% | ×1.19 | 1 | Get out 5 times · Slay 31 in one night · Slay 2 elites in one night |
| 5 | The Mob District | The Back Lots | 14 | ×1.57 | ×1.32 | ×1.39 | 6% | ×1.25 | 1 | Get out 5 times · Slay 32 in one night · Get out never below 50% HP |
| 6 | The Mob District | The Club | 17 | ×1.72 | ×1.4 | ×1.48 | 6% | ×1.31 | 2 | Get out 6 times · Slay the Don · Wipe out 6 pods in one night |
| 7 | The Black Docks | The Wharf | 21 | ×1.88 | ×1.48 | ×1.58 | 6% | ×1.37 | 2 | Get out 6 times · Slay 34 in one night · Wipe out 7 pods in one night |
| 8 | The Black Docks | The Warehouses | 24 | ×2.05 | ×1.56 | ×1.68 | 6% | ×1.43 | 2 | Get out 7 times · Slay 3 elites in one night · Slay 25 before 3:00 |
| 9 | The Black Docks | The Drowned Pier | 27 | ×2.21 | ×1.63 | ×1.77 | 6% | ×1.5 | 2 | Get out 7 times · Slay the Harbormaster · Get out never below 50% HP |
| 10 | The Night Market | Lantern Row | 30 | ×2.38 | ×1.71 | ×1.87 | 6% | ×1.56 | 2 | Get out 8 times · Slay 37 in one night · Slay 26 before 3:00 |
| 11 | The Night Market | The Stalls | 33 | ×2.55 | ×1.79 | ×1.97 | 6% | ×1.62 | 3 | Get out 8 times · Slay 38 in one night · Wipe out 7 pods in one night |
| 12 | The Night Market | The Big Top | 37 | ×2.72 | ×1.87 | ×2.06 | 7% | ×1.68 | 3 | Get out 8 times · Slay the Ringmaster · Slay 3 elites in one night |
| 13 | The Blackwood | The Treeline | 40 | ×2.89 | ×1.95 | ×2.16 | 7% | ×1.74 | 3 | Get out 9 times · Slay 40 in one night · Slay 28 before 3:00 |
| 14 | The Blackwood | The Hollow | 43 | ×3.07 | ×2.03 | ×2.26 | 7% | ×1.81 | 3 | Get out 9 times · Wipe out 8 pods in one night · Get out never below 50% HP |
| 15 | The Blackwood | The Wolf Den | 46 | ×3.24 | ×2.11 | ×2.35 | 7% | ×1.87 | 3 | Get out 10 times · Slay the Alpha · Reach full Frenzy |
| 16 | Hollow Graves | The Lychgate | 49 | ×3.42 | ×2.19 | ×2.45 | 7% | ×1.93 | 4 | Get out 10 times · Slay 43 in one night · Slay 4 elites in one night |
| 17 | Hollow Graves | The Old Plots | 52 | ×3.6 | ×2.27 | ×2.54 | 7% | ×1.99 | 4 | Get out 11 times · Get out never below 50% HP · Reach full Frenzy |
| 18 | Hollow Graves | The Mausoleum | 55 | ×3.78 | ×2.35 | ×2.64 | 7% | ×2.06 | 4 | Get out 11 times · Slay the Gravelord · Slay 30 before 3:00 |
| 19 | Ashen Manor | The Gardens | 58 | ×3.96 | ×2.43 | ×2.74 | 8% | ×2.12 | 4 | Get out 12 times · Slay 46 in one night · Get out never below 50% HP |
| 20 | Ashen Manor | The Long Halls | 62 | ×4.14 | ×2.51 | ×2.83 | 8% | ×2.18 | 4 | Get out 12 times · Reach full Frenzy · Slay 4 elites in one night |
| 21 | Ashen Manor | The Ballroom | 65 | ×4.32 | ×2.59 | ×2.93 | 8% | ×2.24 | 5 | Get out 13 times · Slay the Countess · Wipe out 9 pods in one night |
| 22 | Cathedral of Dawn | The Nave | 68 | ×4.51 | ×2.67 | ×3.03 | 8% | ×2.3 | 5 | Get out 13 times · Slay 49 in one night · Wipe out 9 pods in one night |
| 23 | Cathedral of Dawn | The Cloister | 71 | ×4.69 | ×2.74 | ×3.12 | 8% | ×2.37 | 5 | Get out 13 times · Slay 33 before 3:00 · Get out never below 50% HP |
| 24 | Cathedral of Dawn | The Reliquary | 74 | ×4.87 | ×2.82 | ×3.22 | 8% | ×2.43 | 5 | Get out 14 times · Slay the Inquisitor · Slay 5 elites in one night |
| 25 | The Deep Catacombs | The Ossuary Stair | 77 | ×5.06 | ×2.9 | ×3.32 | 8% | ×2.49 | 5 | Get out 14 times · Slay 52 in one night · Reach full Frenzy |
| 26 | The Deep Catacombs | The Burial Halls | 80 | ×5.25 | ×2.98 | ×3.41 | 8% | ×2.55 | 6 | Get out 15 times · Slay 5 elites in one night · Slay 34 before 3:00 |
| 27 | The Deep Catacombs | The Bone Throne | 83 | ×5.43 | ×3.06 | ×3.51 | 9% | ×2.61 | 6 | Get out 15 times · Slay the Bone Colossus · Get out never below 50% HP |
| 28 | The Crimson Spire | The Causeway | 86 | ×5.62 | ×3.14 | ×3.61 | 9% | ×2.68 | 6 | Get out 16 times · Slay 55 in one night · Get out never below 50% HP |
| 29 | The Crimson Spire | The Blood Gardens | 89 | ×5.81 | ×3.22 | ×3.7 | 9% | ×2.74 | 6 | Get out 16 times · Reach full Frenzy · Slay 6 elites in one night |
| 30 | The Crimson Spire | The Elder’s Throne | 92 | ×6 | ×3.3 | ×3.8 | 9% | ×2.8 | 6 | Get out 17 times · Slay the Elder · Slay 36 before 3:00 |

## Costs

| What | Paid with | Curve (with PACE 1.45) |
| --- | --- | --- |
| Hero level | XP | 30 + 26 × level^1.95 (56 for level 2, ~74,000 for level 60). Capped at 60. |
| Gear level | Blood | 16.7 × level^2.35 (17 for level 2, ~156,000 for level 50). About 2.4 million Blood a slot. |
| Weapon tier | Ichor, plus the weapon level it starts at | Kindred 87 (level 10), Awakened 348 (20), Ascendent 928 (32), Immortal 2,175 (44) |
| Weapon rank | Kills with the weapon | Tier kills × (1 + rank × 0.5): Immortal needs 493, 740, 986… |
| Blood power rank | Vitae | 9, 20, 37, 58, 85, 117, 155, 197, 245, 298 |
| Rite rank | Vitae | Long Night, Blood Pact, Ichor Scent: 16 → 256 over six ranks. Frenzy 20 → 246 over five. Thrall Master 13 → 158 over five. |
| Work level | Materials (the Font also takes Blood) | Base × (level + 1)^1.6: the Bone Forge goes from 6 Bone + 4 Brass to 1,339 + 1,004 |

## What each step is worth

- Hero level: one attribute point, and +1 Fortitude and Resistance.
- Attribute point: +0.6 damage (Might), +1.5% damage with that weapon type (mastery), +4 HP, +0.25 HP/s, +3% speed, +0.2% lifesteal, +1.5% Blood, or −0.7% damage taken.
- Gear level: weapon +2 Strength, +0.5 Vitality, +0.5 flat damage; coat +2 Fortitude, +1.5 Vitality, +2.5 HP, +0.5 armor; cape +1.5 Sorcery, +1 Resistance, +2% skill damage; boots +2 Agility, +0.5 Fortitude.
- Weapon tier: ×1.00, ×1.08, ×1.20, ×1.35, ×1.52 damage, plus 1.5–1.8% a rank.
- Blood power rank: +5% skill damage, −2% cooldown.
- Rites: Long Night +15 s, Blood Pact +5% kept on a loss, Frenzy +2 stacks, Ichor Scent +0.5% elite chance, Thrall Master +20% offline.
- Works: Bone Forge +1% weapon damage, Blood Font +1.5% HP, Bile Still +1.5% skill damage, Brass Coffer +1.5% Blood, Ossuary +0.2% crit.
- Feeding: every kill adds a stack to its stat, giving up to +60; half of that takes about 8,700 feeds of one stat.
- Frenzy: +5% Blood a stack.
- Lifesteal is capped at 12%.
- Bosses grow 3% HP a fall for their first twenty falls; the tier does the rest.
- Offline thralls: 6 feeds an hour for up to 8 hours (+20% a Thrall Master rank), paid at the deepest tier open.

## Tuning

Every number above lives in code: `src/game/pace.ts` (overall length), `src/game/balance.ts` (levels, gear, tiers, stacks, enemies, bosses), `src/game/nights.ts` (the tier ladder, Ichor, Vitae, powers, rites), `src/game/haven.ts` (works), `src/game/maps.ts` (maps, zones, pods, rosters, bosses, boss gates), and `src/game/marks.ts` (marks, the Omen). Change one, run `npm run pacing`, and check that every map is cleared around month 8 and peak lands before month 10 at 4.5 nights a day.
