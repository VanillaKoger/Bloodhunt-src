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

## At 0 steps

| Creature | Role | HP | Damage | Speed | Armor | XP | Blood | Range | Feeds | Drops |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | Skirmisher | 26 | 6 | 2.60 | 0 | 4 | 4 | 1.05 | Agility | 40% × 1 Bone |
| Plague Walker | Bruiser | 70 | 11 | 1.20 | 5 | 7 | 7 | 1.3 | Vitality | 70% × 1 Bile |
| Feral Thrall | Hunter | 58 | 13 | 2.10 | 5 | 8 | 8 | 1.3 | Strength | 50% × 2 Bile |
| Miasma | Artillery | 34 | 8 | 1.40 | 2 | 7 | 6 | 4.6 | Sorcery | 80% × 1 Bile |
| Skeleton | Bruiser | 48 | 9 | 1.35 | 4 | 6 | 6 | 1.28 | Strength | 100% × 2 Bone |
| Mob Thug | Muscle | 76 | 14 | 1.58 | 5 | 9 | 8 | 1.32 | Strength | 65% × 1 Brass |
| Enforcer | Wall | 112 | 18 | 1.28 | 8 | 12 | 11 | 1.38 | Vitality | 100% × 2 Brass |

The miasma is the only ranged one: it holds off at range and spits bile bolts, and backs away when the hero closes inside 2.3 m. Skeletons are the KayKit minion and stab on the clip's contact frame. Drops roll on every kill; an elite always drops, and drops double. The Haven's range dummies use the walker, thrall, and skeleton models with their armor fixed at 0, 12, and 30.

## Growth per step

| Creature | HP | Damage | Speed | Speed cap | Armor step | Reward |
| --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | 7% | 4% | 1.2% | 3.20 | +0.40 | 6% |
| Plague Walker | 9% | 5.5% | 0.8% | 1.70 | +0.80 | 5% |
| Feral Thrall | 8% | 6% | 1% | 2.80 | +0.70 | 5.5% |
| Miasma | 6% | 7% | 0.6% | 1.80 | +0.35 | 7% |
| Skeleton | 9% | 5.5% | 0.8% | 1.90 | +0.80 | 5% |
| Mob Thug | 7% | 5% | 0.8% | 2.10 | +0.60 | 5% |
| Enforcer | 8% | 5% | 0.6% | 1.70 | +0.90 | 5% |

Hounds stay the fragile pack and gain speed first. Walkers and skeletons are the HP walls. Thralls hit hardest for their size. The miasma scales its bolts. Reward growth is the same number for XP and Blood.

Worked example, Danger III at the start of a Slums night (steps = 9):

| Creature | HP | Damage | Speed | Armor | XP | Blood |
| --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | 42 | 8.16 | 2.88 | 3.6 | 6 | 6 |
| Plague Walker | 127 | 16.45 | 1.29 | 12.2 | 10 | 10 |
| Feral Thrall | 100 | 20.02 | 2.29 | 11.3 | 12 | 12 |
| Miasma | 52 | 13.04 | 1.48 | 5.15 | 11 | 10 |
| Skeleton | 87 | 13.46 | 1.45 | 11.2 | 9 | 9 |
| Mob Thug | 124 | 20.30 | 1.69 | 10.4 | 13 | 12 |
| Enforcer | 193 | 26.10 | 1.35 | 16.1 | 17 | 16 |

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

He is a bloated plague walker at boss size, with a crown, a cape of rags, and claws. At 60% HP he calls two plague hounds from the rim of his ring. On top of his Blood, Ichor, and Vitae he drops 10 Bile, 6 Bone, and 4 Brass. The Don drops 14 Brass and 4 Bone.

## Where they appear

Slums enemies come in pods at fixed spots (`PODS` in `src/game/balance.ts`). A pod wakes when the hero is within 24 m of its spot (but not closer than 5.5 m, so nothing lands on the hero), rolls one mix by weight, and stands its members around the spot. Idle members drift no more than 2.2 m off it. When one member sees the hero or takes a hit, the whole pod hunts together with a 15 m reach for 6 seconds, refreshed while any of them still sees or feels the hero. A wiped pod is gone for its "back after" time, then wakes again with a fresh roll. From Danger III a pod brings one extra of its first kind.

| Pod | Spot | Back after | Mixes (weight) |
| --- | --- | --- | --- |
| Court rabble | (4.00, -6.40) | 30s | Plague Hound + Plague Hound + Plague Walker (3); Mob Thug + Mob Thug (2); Plague Hound + Plague Hound + Plague Hound (2) |
| Crypt steps | (-5.40, 6.80) | 34s | Plague Walker + Plague Hound (3); Feral Thrall + Plague Hound (2); Mob Thug + Plague Walker (2); Skeleton + Skeleton (1) |
| North pocket | (0.80, 15.91) | 28s | Plague Hound + Plague Hound (3); Feral Thrall (2) |
| Chapel court | (-37.40, 19.40) | 40s | Plague Walker + Plague Walker + Feral Thrall (3); Mob Thug + Mob Thug + Mob Thug (2) |
| King's yard | (-44.20, 27.20) | 40s | Feral Thrall + Plague Hound + Plague Hound (3); Miasma + Plague Walker (2); Skeleton + Plague Hound (1) |
| South pocket | (-8.00, -24.15) | 32s | Miasma + Plague Hound (3); Mob Thug + Mob Thug (2) |
| Bend pocket | (-20.90, -34.00) | 32s | Plague Hound + Plague Hound + Plague Hound (3); Plague Walker + Miasma (2) |
| Bone yard | (-25.00, -47.20) | 45s | Plague Walker + Plague Walker + Miasma (3); Feral Thrall + Feral Thrall (2); Skeleton + Skeleton + Skeleton (1) |
| Sewer mouth | (-19.60, -42.40) | 40s | Mob Thug + Mob Thug + Miasma (3); Plague Walker + Plague Hound + Plague Hound (2) |

| Mark | Place | Point |
| --- | --- | --- |
| Rat King | Ring in the chapel yard (Zone 2) | center (−40.20, 24.20), radius 1.95 |
| Litter | Rim of that ring | (−39.10, 23.25), (−41.35, 25.05) |

The mob district keeps its own returning thugs and enforcers on the square.

`?spawns=1` draws the pod rings, their names, and the king ring. It is a debug view, not part of a normal fight.
