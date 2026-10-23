# Enemy stats

Enemies no longer grow with the hero's level. They grow with the night: the district, the danger picked at the Haven, and how long the night has run (see `src/game/nights.ts`). Stats are stamped when a creature spawns or returns.

Steps = `district steps + danger steps + minutes into the night × 0.9`

| | Danger I | II | III | IV | V |
| --- | --- | --- | --- | --- | --- |
| Danger steps | 0 | 4 | 9 | 15 | 22 |
| Blood multiplier | ×1 | ×1.35 | ×1.8 | ×2.4 | ×3.2 |
| Elite chance | 6% | 9% | 12% | 15% | 18% |

The Slums add 0 steps and pay ×1. The Mob District adds 3 steps and pays ×1.25 on top. Elites have ×2.4 HP, ×1.3 damage, triple Blood, and drop Ichor. The Rat King and the Don keep their own formulas below, scaled by the same steps (+6% HP, +4% damage and pound, +5% XP and Blood per step).

The tables below are at 0 steps (the old "level 1, no clears" row) and use the same growth per step.

- HP = round(base HP × (1 + steps × HP growth))
- Damage = base damage × (1 + steps × damage growth)
- Speed = min(speed cap, base speed × (1 + steps × speed growth))
- Armor = base armor + steps × armor step
- XP and Blood = round(base × (1 + steps × reward growth))

Damage taken = max(1, raw × (1 − armor / (armor + 40))). Armor 0 is a full hit. Stats are stamped when a creature spawns or returns, so a level-up mid-fight waits for the next life.

## Level 1, no clears

| Creature | Role | HP | Damage | Speed | Armor | XP | Blood | Range | Return | Cap | Cap while the king is up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gutter Rat | Skirmisher | 22 | 5 | 2.45 | 0 | 4 | 4 | 1.05 | 4.5s | 3 | 4 |
| Ghoul | Bruiser | 48 | 9 | 1.35 | 4 | 6 | 6 | 1.28 | 7s | 2 | 1 |
| Slum Wolf | Hunter | 62 | 12 | 2.05 | 6 | 8 | 7 | 1.32 | 9s | 2 | 1 |
| Hedge Witch | Artillery | 34 | 8 | 1.45 | 2 | 7 | 6 | 4.6 | 11s | 1 | 0 |

HP, damage, speed, XP, and Blood on this row match the previous alley. Armor is new. The rat's armor is 0, so a rat still takes the full hit. Ghoul armor 4 is about 9% off a hit, witch armor 2 is about 5%, and wolf armor 6 is about 13% (the wolf is the one that picks up an extra swing).

The mob district stays closed. Its rows are in the same table so the gate can open later without a second formula.

| Creature | Role | HP | Damage | Speed | Armor | XP | Blood | Return | Cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mob Thug | Muscle | 76 | 14 | 1.58 | 5 | 9 | 8 | 8s | 3 |
| Enforcer | Wall | 112 | 18 | 1.28 | 8 | 12 | 11 | 10s | 2 |

## Growth per step

| Creature | HP | Damage | Speed | Speed cap | Armor step | Reward |
| --- | --- | --- | --- | --- | --- | --- |
| Gutter Rat | 7% | 4% | 1.2% | 3.10 | +0.40 | 6% |
| Ghoul | 9% | 5.5% | 0.8% | 1.90 | +0.80 | 5% |
| Slum Wolf | 8% | 6% | 1.0% | 2.70 | +0.70 | 5.5% |
| Hedge Witch | 6% | 7% | 0.6% | 1.80 | +0.35 | 7% |
| Mob Thug | 7% | 5% | 0.8% | 2.10 | +0.60 | 5% |
| Enforcer | 8% | 5% | 0.6% | 1.70 | +0.90 | 5% |

Rats stay the fragile swarm and gain speed first. Ghouls are the HP wall. Wolves hit hardest and wear the most armor. Witches stand off and scale their bolts. Reward growth is the same number for XP and Blood.

Worked example, level 5 and 2 clears (steps = 5):

| Creature | HP | Damage | Speed | Armor | XP | Blood |
| --- | --- | --- | --- | --- | --- | --- |
| Gutter Rat | 30 | 6.00 | 2.60 | 2.0 | 5 | 5 |
| Ghoul | 70 | 11.48 | 1.40 | 8.0 | 8 | 8 |
| Slum Wolf | 87 | 15.60 | 2.15 | 9.5 | 10 | 9 |
| Hedge Witch | 44 | 10.80 | 1.49 | 3.75 | 9 | 8 |

## Rat King

His HP, damage, pound, speed, XP, and Blood stay on the old formula. Armor is the only new king stat, and the first summon is still 0.

- HP = round((460 + Strength × 5.5) × 1.18 ^ bossKills)
- Damage = 11 + bossKills × 2
- Pound = 16 + bossKills × 3
- Speed = 1.5
- XP = 48
- Blood = 200
- Armor = bossKills × 3
- Returns 75 seconds after he falls, and the kill still grants +2 to every stat

A clear does not raise his Blood or XP. It does add half a step to every trash kind.

## Where they appear

Nothing lands on the hero (keep 2.15 away) or inside a wall. If the nest is blocked, that creature waits and tries again. Litter rats called at 60% king HP do not take a nest, so they do not come back under his feet.

| Mark | Place | Point |
| --- | --- | --- |
| Rats, opening | Zone 1, the center | (2.20, −2.20), (−4.60, −1.80) |
| Rat, fills the cap | Pocket on the alley to Zone 3 | (−20.90, −34.00) |
| Ghoul, opening | Zone 1, by the crypt | (−2.80, 6.40) |
| Ghoul, fills the cap | Zone 3 | (−24.60, −48.40) |
| Ghoul, fallback | Pocket on the alley to Zone 3 | (−8.00, −24.15) |
| Wolf, opening | Pocket on the alley to Zone 2 | (0.80, 13.60) |
| Wolf, fills the cap | Zone 2, off the king ring | (−42.60, 25.20) |
| Witch, opening | Zone 1, west of the barred gate | (4.80, −4.40) |
| Witch, fallback | Zone 3 | (−26.40, −45.20) |
| Rat King | Ring in Zone 2 | center (−40.20, 24.20), radius 1.95 |
| Litter | Rim of that ring | (−12.05, 14.35), (−14.55, 16.35) |

`?spawns=1` draws the discs, the labels, and the king ring. It is a debug view, not part of a normal fight.
