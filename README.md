# Blood-hunt: Eternal Thirst (source mirror)

Private coding source for Claude Cloud / external agents.

- **Source of truth (Cursor Origin):** `devon-bosom/tmp-f762bdcefbb45f37`
- **Playtest / GitHub Pages (built site only):** https://github.com/VanillaKoger/Bloodhunt — leave untouched

This mirror holds the TypeScript under `src/`, configs, scripts, and the free `public/` asset packs the game loads at runtime (KayKit / Kenney / Quaternius CC0, plus Atomic Realm FREE Starter apocalypse props). See `CREDITS.md` and `public/kenney/PACKS.txt`.

Asset trees were restored from the Pages build's `cc0/` and `kenney/` (same free packs the game uses). Origin `git clone` auth was unavailable on this box; some non-runtime art sketches under `games/vampire-incremental/art/` may still be absent.

## Free weapon packs

- **KayKit Fantasy Weapons Bits 1.0 (FREE / CC0)** — full pack at `public/cc0/kaykit/weapons/` (`License.txt`, `Assets/gltf|fbx|fbx(unity)|obj`, `Textures/`). 31 glTF stems (arrows, axes, bows, daggers, fistweapons, halberd, hammers, shields, spear, staffs, swords, wand). Runtime starters still use `public/cc0/kaykit/dagger_A` + `fistweapon_A` (and `bone_A` mace from Halloween Bits).
