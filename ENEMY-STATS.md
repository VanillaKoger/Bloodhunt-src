# Enemy stats

Enemies no longer grow with the hero's level. They grow with the night: the district, the danger picked at the Haven, and how long the night has run (see `src/game/nights.ts`). Stats are stamped when a creature spawns or returns.

Steps = `the zone's tier steps + minutes into the night × 0.9`

Each of the 30 zones is a tier on one ladder, from the Slums' Court (tier 1: 0 steps, bite ×1, tough ×1) to the Elder's Throne (tier 30: 92 steps, bite ×6, tough ×3.3). Bite multiplies enemy damage and tough multiplies enemy HP on top of the steps. The full table is in `PROGRESSION.md`. Elites have ×2.4 HP, ×1.3 damage, triple Blood, always drop their material (doubled), and drop Ichor. Bosses keep their own formulas below, scaled by the same steps (+6% HP, +4% damage and pound, +2% XP and Blood per step), by the tier's tough, and by its bite to the power 0.75.

The tables below are at 0 steps (the old "level 1, no clears" row) and use the same growth per step.

- HP = round(base HP × (1 + steps × HP growth) × tough)
- Damage = base damage × (1 + steps × damage growth) × bite
- Speed = min(speed cap, base speed × (1 + steps × speed growth))
- Armor = base armor + steps × armor step
- XP and Blood = round(base × (1 + steps × reward growth))

Damage taken = max(1, raw × (1 − armor / (armor + 40))). Armor 0 is a full hit. Stats are stamped when a creature spawns or returns, so a level-up mid-fight waits for the next life.

## At 0 steps

| Creature | Role | HP | Damage | Speed | Armor | XP | Blood | Range | Feeds (+0.01 a kill) | Drops |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | Skirmisher | 26 | 6 | 2.60 | 0 | 4 | 4 | 1.05 | Agility | 40% × 1 Bone |
| Plague Walker | Bruiser | 70 | 11 | 1.20 | 5 | 7 | 7 | 1.3 | Vitality | 70% × 1 Bile |
| Feral Thrall | Hunter | 58 | 13 | 2.10 | 5 | 8 | 8 | 1.3 | Strength | 50% × 2 Bile |
| Miasma | Artillery | 34 | 8 | 1.40 | 2 | 7 | 6 | 4.6 | Sorcery | 80% × 1 Bile |
| Skeleton | Bruiser | 48 | 9 | 1.35 | 4 | 6 | 6 | 1.28 | Strength | 100% × 2 Bone |
| Mob Thug | Muscle | 76 | 14 | 1.58 | 5 | 9 | 8 | 1.32 | Strength | 65% × 1 Brass |
| Enforcer | Wall | 112 | 18 | 1.28 | 8 | 12 | 11 | 1.38 | Vitality | 100% × 2 Brass |

Each kind also has one ability, and every attack winds up behind a ground marker (gold for a plain swing, red for an ability). The abilities, poise, staggers, and Feeds are in the README's Combat section and `src/game/combat.ts`.

| Creature | Ability | Wind-up | Cooldown | Hit | Poise (share of HP to stagger) |
| --- | --- | --- | --- | --- | --- |
| Plague Hound | Flank Lunge | 0.62 s | 5.5 s | ×1.4 | 60% |
| Plague Walker | Bile Retch (+ pool, ×0.32 a half second) | 0.85 s | 7 s | ×1.2 | 50% |
| Feral Thrall | Pounce, then winded 1.1 s | 0.66 s | 6.5 s | ×1.45 | 45% |
| Miasma | Acid Lob (+ pool, ×0.28 a half second) | 0.95 s | 6.5 s | ×1.5 | 50% |
| Skeleton | Reassemble at 50% HP unless the pile is struck within 3.2 s | — | once | — | 50% |
| Mob Thug | Haymaker Charge, then dazed 1.2 s | 0.78 s | 7.5 s | ×1.6 | 45% |
| Enforcer | Bulwark: 75% off hits to his front | — | always | — | 55% |

Plain swings wind up for 0.36 s (hound) to 0.7 s (enforcer). The poise share is for the claws; the weapon's poise scales it (dagger 0.8, claws 1, sword 1.1, mace 1.7).

The miasma is the only ranged one: it holds off at range and spits bile bolts down a gold lane, and backs away when the hero closes inside 2.3 m. Skeletons are the KayKit minion and stab on the clip's contact frame. Drops roll on every kill; an elite always drops, and drops double. The Haven's range dummies use the walker, thrall, and skeleton models with their armor fixed at 0, 12, and 30.

## Growth per step

| Creature | HP | Damage | Speed | Speed cap | Armor step | Reward |
| --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | 7% | 4% | 1.2% | 3.20 | +0.40 | 2% |
| Plague Walker | 9% | 5.5% | 0.8% | 1.70 | +0.80 | 2% |
| Feral Thrall | 8% | 6% | 1% | 2.80 | +0.70 | 2% |
| Miasma | 6% | 7% | 0.6% | 1.80 | +0.35 | 2% |
| Skeleton | 9% | 5.5% | 0.8% | 1.90 | +0.80 | 2% |
| Mob Thug | 7% | 5% | 0.8% | 2.10 | +0.60 | 2% |
| Enforcer | 8% | 5% | 0.6% | 1.70 | +0.90 | 2% |

Hounds stay the fragile pack and gain speed first. Walkers and skeletons are the HP walls. Thralls hit hardest for their size. The miasma scales its bolts. Reward growth is the same number for XP and Blood.

Worked example at 24 steps, bite ×1.9, tough ×1.5 (about tier 8, the Black Docks' Warehouses):

| Creature | HP | Damage | Speed | Armor | XP | Blood |
| --- | --- | --- | --- | --- | --- | --- |
| Plague Hound | 105 | 22.34 | 3.20 | 9.6 | 6 | 6 |
| Plague Walker | 332 | 48.49 | 1.43 | 24.2 | 10 | 10 |
| Feral Thrall | 254 | 60.27 | 2.60 | 21.8 | 12 | 12 |
| Miasma | 124 | 40.74 | 1.60 | 10.4 | 10 | 9 |
| Skeleton | 228 | 39.67 | 1.61 | 23.2 | 9 | 9 |
| Mob Thug | 306 | 58.52 | 1.88 | 19.4 | 13 | 12 |
| Enforcer | 491 | 75.24 | 1.46 | 29.6 | 18 | 16 |

## Rat King

n = his falls so far, counted up to 20. On top of these, the night's steps, bite, and tough apply.

- HP = round((460 + Strength × 0.75) × (1 + n × 0.03))
- Damage = 11 + n × 0.5
- Pound = 16 + n × 0.8
- Speed = 1.5
- XP = 48
- Blood = 200
- Armor = 2 for each of his first ten falls, plus 0.6 per night step
- Returns 75 seconds after he falls, and the kill still grants +2 to every stat

The heavier sheet (680 + Strength × 0.85 HP, 14 damage, 20 pound) is used by the Countess, the Inquisitor, and the Elder. Every other boss uses the Rat King's.

He is a bloated plague walker at boss size, with a crown, a cape of rags, and claws. He swings behind a gold marker and pounds the ground in a red ring every 4.6 s. At 60% HP he calls two plague hounds from the rim of his ring and starts leaping for the hero's flank; at 30% he is enraged (20% faster, 28% shorter cooldowns, and the pound lands three times in a row). Each stagger needs 60% more poise than the last. On top of his Blood, Ichor, and Vitae he drops 10 Bile, 6 Bone, and 4 Brass (times the danger's material multiplier). The Don drops 14 Brass and 4 Bone.

## Where they appear

Enemies come in pods at fixed spots in each zone (`pods` on each zone in `src/game/maps.ts`). A pod wakes when the hero is within 24 m of its spot (but not closer than 5.5 m, so nothing lands on the hero), rolls one mix by weight, and stands its members around the spot. Idle members drift no more than 2.2 m off it. When one member sees the hero or takes a hit, the whole pod hunts together with a 15 m reach for 6 seconds, refreshed while any of them still sees or feels the hero. A wiped pod is gone for its respawn time, then wakes again with a fresh roll. From tier 11 a pod brings one extra of its lead, and from tier 21 two.

The Slums' pods are hand-placed in its three courts. The placeholder zones place five pods from the room layout, clear of the start, the way out, and the boss ring, and roll their mixes from the map's roster (a pack animal, a brute, a hunter, and one that stands off).

| Mark | Place | Point |
| --- | --- | --- |
| Rat King | Ring in the chapel yard (Zone 3) | center (−40.20, 24.20), radius 1.95 |
| Litter | Rim of that ring | (−39.10, 23.25), (−41.35, 25.05) |

Every other boss is called out at the ring in its map's last zone. At 60% HP it calls two of the zone's own to its side and starts its own move (the README lists them); at 30% it is enraged like the king.

`?spawns=1` draws the Slums' pod rings, their names, and the king ring. It is a debug view, not part of a normal fight.
