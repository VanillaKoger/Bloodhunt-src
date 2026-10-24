# Credits

Every pack the shipped game loads is listed here, and nothing else. The KayKit, Quaternius, and Kenney packs below are **CC0 1.0**. The Atomic Realm starter is free to use in a commercial game with credit and is not CC0: it cannot be repackaged, resold, or redistributed as a pack. Nothing in this game is from a paid Extra, Plus, Source, or Pro tier. Free files only. No author listed here endorses this game.

The map decorations in the placeholder zones (`src/game/mapart.ts`, `MODEL`) reuse props from the packs below that the city already loads; `src/game/decor.ts` bakes them to flat colors at load. They add no pack of their own.

A short version of this list is at the bottom of the in-game gear menu.

Characters use three animation pipelines that never share clips: **K**, KayKit Rig_Medium clips on KayKit characters (the hero, the skeletons); **U**, Quaternius Universal Animation Library clips on Universal Base Characters and Modular Outfits, which share one skeleton; and **N**, a pack's own clips on its own model (the rat, the bat, the Zombie Apocalypse Kit people and dogs, the Ultimate Animated Animals, and Kenney Mini Characters).

## KayKit — Kay Lousberg

Author: Kay Lousberg — https://www.kaylousberg.com

- Character Pack: Adventurers 2.0 (free) — the vampire is the Mage, with a pale head and a red cape
  https://kaylousberg.itch.io/kaykit-adventurers
  License: `public/cc0/kaykit/licenses/KayKit-Adventurers.txt`
- Character Animations 1.1 (free) — full Rig_Medium free sets under `public/cc0/kaykit/` (`anim-combat|general|move|ranged|move-advanced|simulation|special|tools.glb`) and archive `public/cc0/kaykit/animations/` (Med_*); runtime uses combat/general/move
  https://kaylousberg.itch.io/kaykit-character-animations
  License: `public/cc0/kaykit/licenses/KayKit-Character-Animations.txt`
- Fantasy Weapons Bits 1.0 (free) — full FREE pack shipped under `public/cc0/kaykit/weapons/` (gltf/fbx/obj + texture + License.txt). Starter right-hand weapons still load from `public/cc0/kaykit/`: `fistweapon_A` (claws), `dagger_A` (dagger), and a lengthened `dagger_A` (sword).
  https://kaylousberg.itch.io/fantasy-weapons-bits
  License: `public/cc0/kaykit/licenses/KayKit-Fantasy-Weapons-Bits.txt` (also `public/cc0/kaykit/weapons/License.txt`)
- Character Pack: Skeletons 1.1 (free) — the ghoul is the Skeleton Minion
  https://kaylousberg.itch.io/kaykit-skeletons
  License: `public/cc0/kaykit/licenses/KayKit-Skeletons.txt`
- Halloween Bits 1.0 (free) — candle, skull candle, bone, gravestone, standing lantern. `bone_A` is also the starter mace, a bone club.
  https://kaylousberg.itch.io/halloween-bits
  License: `public/cc0/kaykit/licenses/KayKit-Halloween-Bits.txt`
- RPG Tools Bits 1.0 (free) — the small tools lantern in the alley
  https://kaylousberg.itch.io/rpg-tools-bits
  License: `public/cc0/kaykit/licenses/KayKit-RPG-Tools-Bits.txt`
- City Builder Bits 1.0 (free CC0, not the Extra or Source) — the eight street buildings A–H without bases are the Slum perimeter, one mesh each. A dumpster, trash, a crate, a bench, and a hydrant stay in the pack.
  https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0
  https://kaylousberg.itch.io/city-builder-bits
  License: `public/cc0/city-bits/LICENSE.txt`

## Quaternius

Author: Quaternius — https://quaternius.com

- Fantasy Props MegaKit, **Standard** tier only — candle and metal torch. Normals and ORM maps are not shipped.
  https://quaternius.itch.io/fantasy-props-megakit
  License: `public/cc0/kaykit/licenses/Quaternius-Fantasy-Props-MegaKit-Standard.txt`
- Downtown City MegaKit, standard tier — brick window, doors, AC unit, bollards, planter, drain
  https://quaternius.com/packs/downtowncitymegakit.html
  License: `public/cc0/downtown/License_Standard.txt`
- Medieval Village MegaKit, **Standard** free tier only (not Pro or Source) — uneven brick and plaster walls, a round-tile roof, a chimney, an overhang, and exterior stairs on the old-town faces
  https://quaternius.itch.io/medieval-village-megakit
  License: `public/cc0/medieval/License_Standard.txt`
- Cyberpunk Game Kit signs — three small alley signs
  https://poly.pizza/m/rsZJjigt1X
  License: `public/cc0/License-signs.txt`
- Easy Enemy Pack (free) — the rat, as the Rat King's litter. Its own skeleton and clips (idle, walk, run, attack), pipeline N. Converted from the pack's FBX to GLB with FBX2glTF; only the rat ships.
  https://quaternius.com
  License: `public/cc0/quaternius-easy-enemies/LICENSE.txt`
- Animated Monster Pack (free) — the bat, as the Bat Swarm. Its own skeleton and its flying clip, pipeline N. Converted from the pack's FBX to GLB with FBX2glTF; only the bat ships.
  https://quaternius.com
  License: `public/cc0/quaternius-animated-monsters/LICENSE.txt`
- Universal Base Characters, **Standard** (free) tier only — the male and female bodies are the walkers and feral thralls, and their heads, eyes, and brows top the outfits below. Pipeline U.
  https://quaternius.com
  License: `public/cc0/quaternius-base-characters/LICENSE.txt`
- Modular Character Outfits – Fantasy, **Standard** (free) tier only — the Ranger outfit is the Cathedral's hunters, bleached white; the Peasant outfit is its zealots. Pipeline U.
  https://quaternius.com
  License: `public/cc0/quaternius-outfits-fantasy/LICENSE.txt`
- Universal Animation Library, **Standard** — Idle, Walk, Walk Formal, Jog, Sprint, Crouch Idle, Crouch Walk, Punch Jab, and Punch Cross. Pipeline U.
  https://quaternius.com
  License: `public/cc0/quaternius-ual/LICENSE.txt`
- Universal Animation Library 2, **Standard** — Zombie Idle, Zombie Walk, Zombie Scratch, and Melee Hook. Pipeline U.
  https://quaternius.com
  License: `public/cc0/quaternius-ual2/LICENSE.txt`

- Zombie Apocalypse Kit (free) — the four zombies are the walkers on every map; Lis, Matt, Sam, and Shaun (single-weapon versions) are the Black Docks' dockhands, with the pistol, SMG, and knife left out so they swing a bat, a saw, or their fists; the German Shepherd is the Mob District's guard dogs and the Pug runs with the Night Market's strays. Each on its own clips, pipeline N. Props for the map decorations: barrels, cinder blocks, a couch, pallets, pipes, trash bags, a stack of tires, a water tower, a chest, and blood decals. The vehicles, weapons, traffic gear, shipping containers, and street-sign props are not shipped.
  https://quaternius.com
  License: `public/cc0/quaternius-zombie-apocalypse/LICENSE.txt` (the pack's own CC0 license file; its header names another Quaternius pack, the text is CC0 1.0)
- Ultimate Animated Animal Pack (free) — the wolf and husky are the hounds; the Shiba Inu and fox join the Night Market's strays; a great wolf is the Alpha. The stag, deer, horses, donkey, and cow graze in the Blackwood, the Night Market, and Ashen Manor. Each on its own clips, pipeline N.
  https://quaternius.com
  License: `public/cc0/quaternius-animated-animals/LICENSE.txt`

  Converted from the packs' glTF exports with glTF Transform: color maps only, downscaled to 1K (eyes and brows 512); the normal, roughness, and ORM maps are dropped. Bodies and outfits are decimated with meshoptimizer. The animation libraries keep only the clips above, without the mannequin mesh. The Zombie Apocalypse Kit and Animated Animals characters keep only the clips the game plays (idle, walk, run, attack; idles for the grazing animals) and keep their own 512 atlas or flat colors. The full packs stay in `art-source/` and are not deployed.

## Atomic Realm

Author: Atomic Realm — https://atomicrealm.itch.io

- Post-Apocalyptic World (FREE Starter) by Atomic Realm — https://atomicrealm.itch.io/ (attribution required; not CC0)
  https://atomicrealm.itch.io/post-apocalyptic-assets
  PLUS and SOURCE were not downloaded. Boarded and broken walls, a barrel, planks, a tire, and a crate, kitbashed onto the brick tenements; the barrel, planks, tire, and crate also dress the Mob District back lots and the Black Docks.
  License: commercial use and edits are allowed. Repackaging, resale, and redistribution of the assets are not, however modified. Credit Atomic Realm with the link above. This game does not claim Atomic Realm's endorsement.
  `public/cc0/apocalypse/LICENSE.txt`

## Ground

The street surface uses these CC0 maps only. Color maps are 1K. Normal maps are 512 and are skipped in `?low=1`. Files are in `public/cc0/ground/`.

- ambientCG Road012B — cracked asphalt through the courts
  https://ambientcg.com/view?id=Road012B
  License: CC0
- Poly Haven cobblestone_floor_08 — cobble under the broken asphalt, and the alley floors
  https://polyhaven.com/a/cobblestone_floor_08
  License: CC0
- Poly Haven damaged_concrete_floor — worn sidewalk strips along the court walls
  https://polyhaven.com/a/damaged_concrete_floor
  License: CC0
- Poly Haven brown_mud_leaves_01 — dirt and mud patches
  https://polyhaven.com/a/brown_mud_leaves_01
  License: CC0

## Kenney

Author: Kenney — https://www.kenney.nl. All CC0; each folder under `public/kenney/` keeps its `License.txt`. Only the files listed in `public/kenney/PACKS.txt` are shipped.

- Graveyard Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/graveyard-kit
  The zombie (the Rat King and the bosses built on it), the vampire (the Countess and the Elder), and the ghost (miasma); fences, iron fence, candle lantern, debris, and rocks in the Slums, the graves, and the catacombs.
- Blocky Characters by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/blocky-characters
  The mob thug, the enforcer, and the Don.
- Retro Urban Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/retro-urban-kit
  Facades, doors, windows, awnings, dumpsters, fire escapes, street lights, pallets, fences, scaffolding, and asphalt tiles.
- City Kit (Roads) by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/city-kit-roads
  The curved street light and the construction fence.
- City Kit Commercial by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/city-kit-commercial
  Low-detail buildings for the outer city, awnings, and an overhang.
- Platformer Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/platformer-kit
  Crate, barrel, and ladder.
- Car Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/car-kit
  A sedan and a taxi.
- Food Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/food-kit
  Street litter: a bag, soda cans, a burger.
- Holiday Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/holiday-kit
  A string of colored lights.
- Cube Pets by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/cube-pets
  The fox, as alley wildlife.
- Fantasy Town Kit by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/fantasy-town-kit
  A lantern post and a cart.
- Mini Characters by Kenney ([www.kenney.nl](https://www.kenney.nl)) — CC0 — https://kenney.nl/assets/mini-characters
  The twelve characters are the Night Market's barkers and masked revelers and the Ashen Manor's servants, on their own idle, walk, sprint, and melee clips (pipeline N). Shipped as the pack's own GLBs with only those clips kept and the color map embedded. The mobility aids are not shipped.
