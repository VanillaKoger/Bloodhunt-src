import type { Foe } from './balance'
import type { FoeLook } from './types'
import { MOB_ARRIVE, MOB_Z, NORTH_ALLEY_SHIFT, SLUM_POCKETS, SLUM_ROOMS, ZONE1, ZONE2, ZONE3, HERO_START, type SlumRect } from './world'

/**
 * The hunting grounds. Ten maps, each with three zones that open one after
 * another. A night is fought in one zone: its own walls, its pods, its way
 * out. Zone 3 of every map holds that map's boss. Clearing a zone's marks
 * opens the next zone, and clearing the last zone (and putting its boss down
 * a few times) opens the next map. Together the zones make one ladder of 30
 * tiers of difficulty (see `tierOf` in nights.ts).
 *
 * The Slums and the Mob District's square are the hand-built maps. Every
 * other zone is laid out here from rectangles and dressed with placeholder
 * art by yard-style builders in mapart.ts, ready for real art later.
 */

export type MapId = 'slums' | 'mob' | 'docks' | 'market' | 'wilds' | 'graves' | 'manor' | 'cathedral' | 'catacombs' | 'spire'

export const MAP_IDS: MapId[] = ['slums', 'mob', 'docks', 'market', 'wilds', 'graves', 'manor', 'cathedral', 'catacombs', 'spire']

export const ZONE_COUNT = 3

export type Rect = SlumRect

export interface Disc {
  x: number
  z: number
  r: number
}

export interface ExtractPoint {
  x: number
  z: number
  label: string
}

/** A fixed spawn point for a pod of enemies. */
export interface PodDef {
  name: string
  x: number
  z: number
  /** Metres from the center the members stand at. */
  spread: number
  mixes: { kinds: Foe[]; weight: number }[]
  /** Seconds after the last member falls before the pod is back. */
  respawn: number
}

export interface ZoneDef {
  name: string
  blurb: string
  /** Walkable ground: rectangles and round pockets. */
  rooms: Rect[]
  pockets: Disc[]
  start: { x: number; z: number }
  extracts: ExtractPoint[]
  pods: PodDef[]
  /** Where the map's boss is called out. Zone 3 only. */
  arena?: { x: number; z: number }
  /** Built from rooms by the placeholder art, or hand-built in world.ts. */
  art: 'slums' | 'square' | 'placeholder'
  /** The sealed gates out of this zone, drawn shut. */
  gates: { x: number; z: number; axis: 'x' | 'z'; span: number }[]
}

export type ThemeId = 'slums' | 'mob' | 'docks' | 'market' | 'wilds' | 'graves' | 'manor' | 'cathedral' | 'catacombs' | 'spire'

export interface Palette {
  /** Clear color and distance fog while hunting here. */
  fog: number
  floor: number
  /** Ground past the walls. */
  ground: number
  wall: number
  /** Emissive color for lamps, runes, and the like. */
  accent: number
  pattern: 'grass' | 'planks' | 'cobble' | 'tile' | 'dirt' | 'marble' | 'stone' | 'asphalt'
  wallStyle: 'hedge' | 'fence' | 'stone' | 'rail' | 'iron' | 'brick'
}

/** Which model a boss is built on, and what is changed about it. */
export interface BossDef {
  name: string
  /** 'boss' and 'don' are the hand-made rigs; the rest restyle a pack character. */
  base: 'king' | 'don' | 'zombie' | 'ghost' | 'vampire' | 'fox' | 'suitB' | 'suitE' | 'suitH'
  look?: {
    scale?: number
    tint?: number
    crown?: boolean
    cape?: boolean
    claws?: boolean
    hat?: boolean
    orb?: boolean
    orbColor?: number
    eyes?: number
    chunky?: boolean
    grey?: boolean
  }
  /** The kill sheet the boss is built from: the Rat King's or the Don's. */
  sheet: 'king' | 'don'
  /** Summon button and HUD lines. */
  call: string
  again: string
  line: string
}

export interface MapDef {
  id: MapId
  label: string
  /** One line for the locked card. */
  theme: string
  blurb: string
  zones: [ZoneDef, ZoneDef, ZoneDef]
  /** Tint per foe kind while hunting here, so a reused model reads as this map's creature. */
  tints: Partial<Record<Foe, number>>
  /** What each foe is called here, for the board's roster line. */
  names: Partial<Record<Foe, string>>
  /** Foes that wear their own model here instead of their kind's (critters.ts). Stats and fight stay the kind's. */
  looks?: Partial<Record<Foe, FoeLook>>
  boss: BossDef
  palette: Palette
  /** Falls of the boss before the next map opens. */
  bossGate: number
}

// ---------------------------------------------------------------- Slums

const SLUM_RECT = (i: number): Rect => SLUM_ROOMS[i]

/** The south alley stops at Zone 1's wall so a Bone Yard night cannot step into the court. */
const southAlley: Rect = { ...SLUM_RECT(5), z1: ZONE1.z0 - 0.4 }
const northAlley: Rect = { ...SLUM_RECT(7), z0: ZONE1.z1 + 0.4 }

const SLUM_PODS_COURT: PodDef[] = [
  {
    name: 'Court rabble',
    x: 4.0,
    z: -6.4,
    spread: 1.3,
    mixes: [
      { kinds: ['hound', 'hound', 'walker'], weight: 3 },
      { kinds: ['thug', 'thug'], weight: 2 },
      { kinds: ['hound', 'hound', 'hound'], weight: 2 },
    ],
    respawn: 26,
  },
  {
    name: 'Crypt steps',
    x: -5.4,
    z: 6.8,
    spread: 1.2,
    mixes: [
      { kinds: ['walker', 'hound'], weight: 3 },
      { kinds: ['thrall', 'hound'], weight: 2 },
      { kinds: ['thug', 'walker'], weight: 2 },
      { kinds: ['skeleton', 'skeleton'], weight: 1 },
    ],
    respawn: 28,
  },
  {
    name: 'Well corner',
    x: 7.2,
    z: 8.6,
    spread: 1.0,
    mixes: [
      { kinds: ['hound', 'hound'], weight: 3 },
      { kinds: ['spitter', 'hound'], weight: 1 },
    ],
    respawn: 24,
  },
  {
    name: 'Drain corner',
    x: -6.8,
    z: -8.6,
    spread: 1.0,
    mixes: [
      { kinds: ['walker', 'hound'], weight: 3 },
      { kinds: ['thug'], weight: 1 },
    ],
    respawn: 24,
  },
]

const SLUM_PODS_BONES: PodDef[] = [
  {
    name: 'South pocket',
    x: -8.0,
    z: -24.15,
    spread: 0.9,
    mixes: [
      { kinds: ['spitter', 'hound'], weight: 3 },
      { kinds: ['thug', 'thug'], weight: 2 },
    ],
    respawn: 28,
  },
  {
    name: 'Bend pocket',
    x: -20.9,
    z: -34.0,
    spread: 0.9,
    mixes: [
      { kinds: ['hound', 'hound', 'hound'], weight: 3 },
      { kinds: ['walker', 'spitter'], weight: 2 },
    ],
    respawn: 28,
  },
  {
    name: 'Bone yard',
    x: -25.0,
    z: -47.2,
    spread: 1.4,
    mixes: [
      { kinds: ['walker', 'walker', 'spitter'], weight: 3 },
      { kinds: ['thrall', 'thrall'], weight: 2 },
      { kinds: ['skeleton', 'skeleton', 'skeleton'], weight: 1 },
    ],
    respawn: 34,
  },
  {
    name: 'Sewer mouth',
    x: -19.6,
    z: -42.4,
    spread: 1.2,
    mixes: [
      { kinds: ['thug', 'thug', 'spitter'], weight: 3 },
      { kinds: ['walker', 'hound', 'hound'], weight: 2 },
    ],
    respawn: 32,
  },
]

const SLUM_PODS_CHAPEL: PodDef[] = [
  {
    name: 'North pocket',
    x: 0.8,
    z: 13.6 + NORTH_ALLEY_SHIFT,
    spread: 0.9,
    mixes: [
      { kinds: ['hound', 'hound'], weight: 3 },
      { kinds: ['thrall'], weight: 2 },
    ],
    respawn: 26,
  },
  {
    name: 'Chapel court',
    x: -37.4,
    z: 19.4,
    spread: 1.4,
    mixes: [
      { kinds: ['walker', 'walker', 'thrall'], weight: 3 },
      { kinds: ['thug', 'thug', 'thug'], weight: 2 },
    ],
    respawn: 32,
  },
  {
    name: "King's yard",
    x: -44.2,
    z: 27.2,
    spread: 1.2,
    mixes: [
      { kinds: ['thrall', 'hound', 'hound'], weight: 3 },
      { kinds: ['spitter', 'walker'], weight: 2 },
      { kinds: ['skeleton', 'hound'], weight: 1 },
    ],
    respawn: 32,
  },
  {
    name: 'Alley bend',
    x: -20.0,
    z: 19.5 + NORTH_ALLEY_SHIFT,
    spread: 0.8,
    mixes: [
      { kinds: ['hound', 'walker'], weight: 3 },
      { kinds: ['thug', 'hound'], weight: 2 },
    ],
    respawn: 28,
  },
]

const SLUMS: MapDef = {
  id: 'slums',
  label: 'The Slums',
  theme: 'Plague tenements under a purple moon.',
  blurb: 'Three courts and the alleys between, rotten with plague. Hounds, walkers, thralls, thugs down from the district, and the Rat King in the chapel yard.',
  zones: [
    {
      name: 'The Court',
      blurb: 'The big court in the middle. Where every hunt starts.',
      rooms: [ZONE1, SLUM_RECT(1)],
      pockets: [],
      start: HERO_START,
      extracts: [{ x: -8.4, z: -11.2, label: 'Storm drain' }],
      pods: SLUM_PODS_COURT,
      art: 'slums',
      gates: [],
    },
    {
      name: 'The Bone Yard',
      blurb: 'Down the south alley to the yard where the dead are piled.',
      rooms: [ZONE3, SLUM_RECT(3), SLUM_RECT(4), southAlley],
      pockets: [SLUM_POCKETS[0], SLUM_POCKETS[1]],
      start: { x: 4.25, z: ZONE1.z0 - 1.6 },
      extracts: [{ x: -28.5, z: -51.4, label: 'Sewer grate' }],
      pods: SLUM_PODS_BONES,
      art: 'slums',
      gates: [],
    },
    {
      name: 'The Chapel Yard',
      blurb: 'Up the north alley to the chapel, where the Rat King holds court.',
      rooms: [ZONE2, northAlley, SLUM_RECT(8)],
      pockets: [SLUM_POCKETS[2]],
      start: { x: -1.25, z: ZONE1.z1 + 1.8 },
      extracts: [{ x: -44.6, z: 17.8, label: 'Chapel door' }],
      pods: SLUM_PODS_CHAPEL,
      arena: { x: -40.2, z: 24.2 },
      art: 'slums',
      gates: [],
    },
  ],
  tints: {},
  names: { hound: 'plague hounds', walker: 'walkers', thrall: 'feral thralls', spitter: 'the miasma', skeleton: 'skeletons', thug: 'thugs' },
  boss: {
    name: 'The Rat King',
    base: 'king',
    sheet: 'king',
    call: 'Call him out',
    again: 'Face him again',
    line: 'The Rat King holds court in the chapel yard.',
  },
  palette: { fog: 0x1c1028, floor: 0x3a2c3a, ground: 0x241a24, wall: 0x62404c, accent: 0xffb15e, pattern: 'cobble', wallStyle: 'brick' },
  bossGate: 3,
}

// ---------------------------------------------------------------- Generic layout

type Shape = 'wide' | 'tall' | 'ell' | 'twin'

/** Rooms for a placeholder zone centered on (ox, oz). The +x/+z side faces the camera. */
function shapeRooms(shape: Shape, ox: number, oz: number): Rect[] {
  switch (shape) {
    case 'wide':
      return [{ x0: ox - 13, x1: ox + 13, z0: oz - 8.5, z1: oz + 8.5 }]
    case 'tall':
      return [{ x0: ox - 8.5, x1: ox + 8.5, z0: oz - 13, z1: oz + 13 }]
    case 'ell':
      return [
        { x0: ox - 6, x1: ox + 11, z0: oz - 2, z1: oz + 10 },
        { x0: ox - 12, x1: ox - 2, z0: oz - 12, z1: oz + 6 },
      ]
    case 'twin':
      return [
        { x0: ox - 1, x1: ox + 12, z0: oz - 4, z1: oz + 9 },
        { x0: ox - 12, x1: ox + 1, z0: oz - 10, z1: oz + 3 },
        { x0: ox - 3, x1: ox + 3, z0: oz - 4, z1: oz + 3 },
      ]
  }
}

function spanOf(rooms: Rect[]): Rect {
  return {
    x0: Math.min(...rooms.map((r) => r.x0)),
    x1: Math.max(...rooms.map((r) => r.x1)),
    z0: Math.min(...rooms.map((r) => r.z0)),
    z1: Math.max(...rooms.map((r) => r.z1)),
  }
}

function inRooms(rooms: Rect[], x: number, z: number, pad: number): boolean {
  return rooms.some((r) => x >= r.x0 + pad && x <= r.x1 - pad && z >= r.z0 + pad && z <= r.z1 - pad)
}

/** Where a zone is in the world: maps sit far apart, and a map's zones run north in a row. */
export function zoneOrigin(mapIndex: number, zone: number): { x: number; z: number } {
  if (mapIndex === 1) return { x: 40, z: MOB_Z + 4 + (zone - 1) * 46 }
  return { x: 150 + (mapIndex - 2) * 110, z: -20 - zone * 46 }
}

interface Roster {
  /** The common pack animal, the bruiser, the hard hitter, and the one that stands off. */
  pack: Foe
  brute: Foe
  hunter: Foe
  ranged: Foe
}

/** Pod mixes per zone, from the map's roster: deeper zones bring bigger, meaner groups. */
function zoneMixes(r: Roster, zone: number): PodDef['mixes'][] {
  if (zone === 0) {
    return [
      [
        { kinds: [r.pack, r.pack], weight: 3 },
        { kinds: [r.pack, r.brute], weight: 2 },
      ],
      [
        { kinds: [r.brute, r.pack], weight: 3 },
        { kinds: [r.ranged, r.pack], weight: 1 },
      ],
    ]
  }
  if (zone === 1) {
    return [
      [
        { kinds: [r.pack, r.pack, r.brute], weight: 3 },
        { kinds: [r.hunter, r.pack], weight: 2 },
      ],
      [
        { kinds: [r.brute, r.ranged], weight: 3 },
        { kinds: [r.hunter, r.hunter], weight: 1 },
      ],
    ]
  }
  return [
    [
      { kinds: [r.hunter, r.brute, r.pack], weight: 3 },
      { kinds: [r.brute, r.brute, r.ranged], weight: 2 },
    ],
    [
      { kinds: [r.hunter, r.hunter, r.ranged], weight: 2 },
      { kinds: [r.pack, r.pack, r.pack, r.hunter], weight: 2 },
    ],
  ]
}

const POD_NAMES = ['North end', 'West end', 'Far corner', 'The middle', 'East end', 'Back wall']

/**
 * A placeholder zone: its rooms, a start on the camera side, a way out on
 * the far side, and pods spread over the floor clear of both.
 */
function placeholderZone(
  mapIndex: number,
  zone: number,
  shape: Shape,
  name: string,
  blurb: string,
  exitLabel: string,
  roster: Roster,
): ZoneDef {
  const o = zoneOrigin(mapIndex, zone)
  const rooms = shapeRooms(shape, o.x, o.z)
  const span = spanOf(rooms)
  const nearRoom = rooms.reduce((a, b) => (b.z1 > a.z1 ? b : a))
  const farRoom = rooms.reduce((a, b) => (b.z0 < a.z0 ? b : a))
  // Start near the camera-side corner, the way out at the far corner.
  const pick = (fx: number, fz: number) => {
    const x = span.x0 + (span.x1 - span.x0) * fx
    const z = span.z0 + (span.z1 - span.z0) * fz
    for (let k = 0; k < 40; k++) {
      const a = k * 0.9
      const px = x + Math.cos(a) * k * 0.3
      const pz = z + Math.sin(a) * k * 0.3
      if (inRooms(rooms, px, pz, 1.6)) return { x: px, z: pz }
    }
    return { x: o.x, z: o.z }
  }
  const start = pick(0.78, 0.82)
  const out = pick(0.16, 0.14)
  const arena = zone === 2 ? pick(0.45, 0.45) : undefined
  const mixes = zoneMixes(roster, zone)
  const pods: PodDef[] = []
  const grid: [number, number][] = [
    [0.25, 0.3],
    [0.72, 0.28],
    [0.3, 0.72],
    [0.55, 0.52],
    [0.8, 0.6],
    [0.15, 0.5],
    [0.5, 0.15],
    [0.5, 0.85],
    [0.85, 0.15],
    [0.15, 0.85],
  ]
  for (const [fx, fz] of grid) {
    const p = pick(fx, fz)
    const clear = [start, out, ...(arena ? [arena] : [])].every((q) => Math.hypot(q.x - p.x, q.z - p.z) > 4)
    if (!clear || pods.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 4.2)) continue
    pods.push({
      name: POD_NAMES[pods.length % POD_NAMES.length],
      x: p.x,
      z: p.z,
      spread: 1.2,
      mixes: mixes[pods.length % mixes.length],
      respawn: 24 + zone * 4,
    })
    if (pods.length >= 5) break
  }
  return {
    name,
    blurb,
    rooms,
    pockets: [],
    start,
    extracts: [{ x: out.x, z: out.z, label: exitLabel }],
    pods,
    arena,
    art: 'placeholder',
    gates: [
      // A sealed way back on the camera side and a sealed way on at the far side, each on a real wall.
      { x: (nearRoom.x0 + nearRoom.x1) / 2, z: nearRoom.z1, axis: 'x', span: 3 },
      { x: (farRoom.x0 + farRoom.x1) / 2, z: farRoom.z0, axis: 'x', span: 3 },
    ],
  }
}

// ---------------------------------------------------------------- Mob District

const MOB_ROSTER: Roster = { pack: 'thug', brute: 'enforcer', hunter: 'thug', ranged: 'hound' }

const MOB: MapDef = {
  id: 'mob',
  label: 'The Mob District',
  theme: 'Neon, wet asphalt, and men in fedoras.',
  blurb: 'The lit square, the back lots behind it, and the club where the Don keeps court. Thugs, enforcers, and their dogs.',
  zones: [
    {
      name: 'The Square',
      blurb: 'One lit square, no alleys to hide in.',
      rooms: [],
      pockets: [{ x: 0, z: MOB_Z, r: 7.45 }],
      start: MOB_ARRIVE,
      extracts: [{ x: -0.3, z: MOB_Z - 5.9, label: 'Back alley' }],
      pods: [
        { name: 'Club steps', x: 3.6, z: MOB_Z + 0.8, spread: 1.0, mixes: [{ kinds: ['thug', 'thug'], weight: 3 }, { kinds: ['enforcer'], weight: 1 }], respawn: 24 },
        { name: 'Diner side', x: -3.4, z: MOB_Z - 0.6, spread: 1.0, mixes: [{ kinds: ['thug', 'thug'], weight: 3 }, { kinds: ['thug', 'enforcer'], weight: 1 }], respawn: 24 },
        { name: 'South curb', x: 2.6, z: MOB_Z - 4.4, spread: 0.9, mixes: [{ kinds: ['thug'], weight: 2 }, { kinds: ['thug', 'thug'], weight: 2 }], respawn: 22 },
        { name: 'North curb', x: -2.8, z: MOB_Z + 4.6, spread: 0.9, mixes: [{ kinds: ['enforcer', 'thug'], weight: 2 }, { kinds: ['thug', 'thug'], weight: 2 }], respawn: 26 },
      ],
      art: 'square',
      gates: [],
    },
    placeholderZone(1, 1, 'wide', 'The Back Lots', 'Warehouses and loading bays behind the square. The muscle sleeps here.', 'Loading dock', { ...MOB_ROSTER, ranged: 'hound' }),
    placeholderZone(1, 2, 'ell', 'The Club', 'The Don’s own floor. Velvet, smoke, and the men he trusts.', 'Kitchen door', { ...MOB_ROSTER, hunter: 'enforcer' }),
  ],
  tints: { hound: 0x5a5a66 },
  names: { thug: 'thugs', enforcer: 'enforcers', hound: 'guard dogs' },
  boss: {
    name: 'The Don',
    base: 'don',
    sheet: 'king',
    call: 'Knock on the office',
    again: 'Face him again',
    line: 'The Don is waiting in his office.',
  },
  palette: { fog: 0x14121e, floor: 0x2a2a34, ground: 0x18181e, wall: 0x4a3a44, accent: 0xff3a8a, pattern: 'asphalt', wallStyle: 'brick' },
  bossGate: 4,
}

// ---------------------------------------------------------------- Placeholder maps

function placeholderMap(
  index: number,
  id: MapId,
  label: string,
  theme: string,
  blurb: string,
  zones: [string, string, string][],
  shapes: [Shape, Shape, Shape],
  roster: Roster,
  tints: Partial<Record<Foe, number>>,
  names: Partial<Record<Foe, string>>,
  boss: BossDef,
  palette: Palette,
): MapDef {
  return {
    id,
    label,
    theme,
    blurb,
    zones: [0, 1, 2].map((z) => placeholderZone(index, z, shapes[z], zones[z][0], zones[z][1], zones[z][2], roster)) as [ZoneDef, ZoneDef, ZoneDef],
    tints,
    names,
    boss,
    palette,
    bossGate: 4,
  }
}

const DOCKS = placeholderMap(
  2,
  'docks',
  'The Black Docks',
  'Fog off the black water, and smugglers who bleed salt.',
  'The harbor below the city. Dockhands, the drowned that crawl up the pilings, sea-fog that spits, and bruisers paid to keep quiet.',
  [
    ['The Wharf', 'Wet boards, crates, and the lamps of the night boats.', 'Rowboat'],
    ['The Warehouses', 'Long sheds of contraband and the men who guard it.', 'Hoist chain'],
    ['The Drowned Pier', 'The far pier, half under water. The Harbormaster waits at its end.', 'Smuggler’s skiff'],
  ],
  ['wide', 'twin', 'tall'],
  { pack: 'thug', brute: 'walker', hunter: 'enforcer', ranged: 'spitter' },
  { thug: 0xb8c8d8, walker: 0x7fb0b0, spitter: 0xd0e8f0, enforcer: 0x9fb0c0 },
  { thug: 'dockhands', walker: 'the drowned', spitter: 'sea-fog', enforcer: 'bruisers' },
  {
    name: 'The Harbormaster',
    base: 'suitB',
    look: { scale: 1.3, tint: 0x9fb4c8, chunky: true, cape: true, eyes: 0x6ad8ff },
    sheet: 'king',
    call: 'Ring the harbor bell',
    again: 'Ring it again',
    line: 'The Harbormaster keeps the far pier.',
  },
  { fog: 0x0e1a24, floor: 0x4a3a2a, ground: 0x0a1820, wall: 0x3a2a1e, accent: 0xffc860, pattern: 'planks', wallStyle: 'rail' },
)

const MARKET = placeholderMap(
  3,
  'market',
  'The Night Market',
  'Lanterns, masks, and a carnival that never closes.',
  'The old town bazaar after midnight. Masked revelers, fire-eaters, barkers, and the strays that eat what falls. The Ringmaster runs it all from the big tent.',
  [
    ['Lantern Row', 'Paper lanterns over cobbles and stalls shut for the night.', 'Cellar hatch'],
    ['The Stalls', 'A maze of awnings, carts, and spilled spice.', 'Wagon gap'],
    ['The Big Top', 'The striped tent at the heart of it. The Ringmaster is on.', 'Performers’ door'],
  ],
  ['tall', 'ell', 'wide'],
  { pack: 'hound', brute: 'thug', hunter: 'thrall', ranged: 'spitter' },
  { hound: 0xc8a070, thug: 0xffe0c0, thrall: 0xffc0a0, spitter: 0xffa040 },
  { hound: 'strays', thug: 'barkers', thrall: 'masked revelers', spitter: 'fire-eaters' },
  {
    name: 'The Ringmaster',
    base: 'suitE',
    look: { scale: 1.25, tint: 0xffd090, hat: true, cape: true, orb: true, orbColor: 0xffa040 },
    sheet: 'king',
    call: 'Take a seat in the ring',
    again: 'Another show',
    line: 'The Ringmaster is about to start the show.',
  },
  { fog: 0x24140e, floor: 0x5a4234, ground: 0x1e120c, wall: 0x6a3a2a, accent: 0xffa040, pattern: 'cobble', wallStyle: 'fence' },
)

const WILDS = placeholderMap(
  4,
  'wilds',
  'The Blackwood',
  'The forest past the city wall, where the wolves are bigger than wolves.',
  'Old forest beyond the last streetlamp. Wolf packs, the wild ones who ran from the city and turned, bramble-walkers, and wisps that lure. The Alpha leads them.',
  [
    ['The Treeline', 'The edge of the wood. You can still see the city lights.', 'Hunter’s path'],
    ['The Hollow', 'A sunken clearing ringed with dead oaks.', 'Fallen log'],
    ['The Wolf Den', 'Bones, fur, and the Alpha’s rock.', 'Old trail'],
  ],
  ['wide', 'ell', 'twin'],
  { pack: 'hound', brute: 'walker', hunter: 'thrall', ranged: 'spitter' },
  { hound: 0x9aa0a8, walker: 0x8a7a50, thrall: 0x9ab080, spitter: 0x9fd0ff },
  { hound: 'wolves', walker: 'bramble-walkers', thrall: 'wild ones', spitter: 'wisps' },
  {
    name: 'The Alpha',
    base: 'fox',
    look: { scale: 1.75, tint: 0x8890a0, grey: true },
    sheet: 'king',
    call: 'Howl at the den',
    again: 'Howl again',
    line: 'The Alpha is watching from his rock.',
  },
  { fog: 0x0c1a12, floor: 0x2e3a22, ground: 0x142012, wall: 0x2a3a1a, accent: 0x9fd0ff, pattern: 'grass', wallStyle: 'hedge' },
)

const GRAVES = placeholderMap(
  5,
  'graves',
  'Hollow Graves',
  'The city’s great cemetery, and the things that will not stay buried.',
  'Rows of the dead behind an iron fence. Skeletons, ghouls, wraiths, and the black dogs that guard them. The Gravelord rules from the mausoleum.',
  [
    ['The Lychgate', 'The gate and the newest plots. The ground is still soft.', 'Gravedigger’s gate'],
    ['The Old Plots', 'Leaning stones and open graves under bare trees.', 'Broken railing'],
    ['The Mausoleum', 'The tomb of the first family. The Gravelord sits inside.', 'Crypt stair'],
  ],
  ['tall', 'wide', 'ell'],
  { pack: 'hound', brute: 'walker', hunter: 'skeleton', ranged: 'spitter' },
  { hound: 0x606070, walker: 0xa0b0a0, spitter: 0xc0d8ff },
  { hound: 'grave dogs', walker: 'ghouls', skeleton: 'skeletons', spitter: 'wraiths' },
  {
    name: 'The Gravelord',
    base: 'zombie',
    look: { scale: 2.4, tint: 0xb0c0b0, crown: true, cape: true, claws: true, eyes: 0x6aff9a },
    sheet: 'king',
    call: 'Knock on the tomb',
    again: 'Knock again',
    line: 'The Gravelord stirs in the mausoleum.',
  },
  { fog: 0x121820, floor: 0x343a34, ground: 0x161a18, wall: 0x4a4e52, accent: 0x6aff9a, pattern: 'dirt', wallStyle: 'iron' },
)

const MANOR = placeholderMap(
  6,
  'manor',
  'Ashen Manor',
  'A rival house of the old blood, and its servants.',
  'The estate of a vampire house older than yours. Servants who were promised the blood, doormen, bloodhounds, and clouds of bats. The Countess receives no one.',
  [
    ['The Gardens', 'Hedges, statues, and a dry fountain.', 'Servants’ gate'],
    ['The Long Halls', 'Portraits that follow you and doors that do not open.', 'Coal chute'],
    ['The Ballroom', 'The Countess dances alone.', 'Balcony'],
  ],
  ['twin', 'tall', 'wide'],
  { pack: 'hound', brute: 'enforcer', hunter: 'thrall', ranged: 'spitter' },
  { hound: 0xa06060, enforcer: 0xd8c8ff, thrall: 0xe0c8e8, spitter: 0xc080ff },
  { hound: 'bloodhounds', enforcer: 'doormen', thrall: 'servants', spitter: 'bat clouds' },
  {
    name: 'The Countess',
    base: 'vampire',
    look: { scale: 2.2, tint: 0xe0c0ff, crown: true, cape: true, claws: true, eyes: 0xff2a6a },
    sheet: 'don',
    call: 'Ask for the dance',
    again: 'Ask again',
    line: 'The Countess is waiting for a partner.',
  },
  { fog: 0x160e1c, floor: 0x3a2a3a, ground: 0x120c14, wall: 0x2a3a24, accent: 0xff2a6a, pattern: 'tile', wallStyle: 'hedge' },
)

const CATHEDRAL = placeholderMap(
  7,
  'cathedral',
  'Cathedral of Dawn',
  'The hunters’ order. They have been waiting for you.',
  'The order that hunts your kind, in their own house. Hunters in white, paladins in plate, zealots, and the choir that burns. The Inquisitor leads the prayer.',
  [
    ['The Nave', 'Pews and candles under the great window.', 'Bell rope'],
    ['The Cloister', 'A square of pillars around a frozen garden.', 'Drain grate'],
    ['The Reliquary', 'Where the order keeps its holy things. And the Inquisitor.', 'Ossuary door'],
  ],
  ['tall', 'twin', 'ell'],
  { pack: 'thug', brute: 'enforcer', hunter: 'thrall', ranged: 'spitter' },
  { thug: 0xf0f0ff, enforcer: 0xfff0c0, thrall: 0xffd0c0, spitter: 0xffe080 },
  { thug: 'hunters', enforcer: 'paladins', thrall: 'zealots', spitter: 'the choir' },
  {
    name: 'The Inquisitor',
    base: 'suitH',
    look: { scale: 1.3, tint: 0xffffff, hat: true, cape: true, orb: true, orbColor: 0xffe080 },
    sheet: 'don',
    call: 'Interrupt the prayer',
    again: 'Interrupt again',
    line: 'The Inquisitor is at prayer.',
  },
  { fog: 0x1a1a24, floor: 0x5a5660, ground: 0x18181e, wall: 0x7a7480, accent: 0xffe080, pattern: 'marble', wallStyle: 'stone' },
)

const CATACOMBS = placeholderMap(
  8,
  'catacombs',
  'The Deep Catacombs',
  'Under the city, where the bones are stacked to the ceiling.',
  'Miles of tunnels under the old town. Skeletons, the tomb-fed, spirits of the stale air, and thralls who went down and never came up. Something large is made of the bones.',
  [
    ['The Ossuary Stair', 'The first landing, walls of skulls.', 'Rope up'],
    ['The Burial Halls', 'Long galleries of niches and sarcophagi.', 'Collapsed shaft'],
    ['The Bone Throne', 'A cavern. The Bone Colossus rises.', 'Underground river'],
  ],
  ['ell', 'wide', 'twin'],
  { pack: 'skeleton', brute: 'walker', hunter: 'thrall', ranged: 'spitter' },
  { walker: 0xc0b8a0, spitter: 0xa0ffa0, thrall: 0xb0a090 },
  { skeleton: 'skeletons', walker: 'the tomb-fed', thrall: 'the lost', spitter: 'stale air' },
  {
    name: 'The Bone Colossus',
    base: 'zombie',
    look: { scale: 2.9, tint: 0xf0e8d0, chunky: true, claws: true, eyes: 0xa0ffa0 },
    sheet: 'king',
    call: 'Climb the throne',
    again: 'Climb again',
    line: 'The bones on the throne are moving.',
  },
  { fog: 0x0e0c0a, floor: 0x3a3428, ground: 0x0e0c0a, wall: 0x5a5040, accent: 0x9aff6a, pattern: 'stone', wallStyle: 'stone' },
)

const SPIRE = placeholderMap(
  9,
  'spire',
  'The Crimson Spire',
  'The Elder’s citadel. The top of the night.',
  'The tower of the Elder who made your kind. Spawn of the old blood, blood knights, wraiths, and the honored dead. Climb to the throne.',
  [
    ['The Causeway', 'The bridge to the spire over a sea of red fog.', 'Bat swarm'],
    ['The Blood Gardens', 'Red crystal and pools of something warm.', 'Crystal rift'],
    ['The Elder’s Throne', 'The top. The Elder is awake.', 'Shattered window'],
  ],
  ['wide', 'ell', 'tall'],
  { pack: 'thrall', brute: 'enforcer', hunter: 'skeleton', ranged: 'spitter' },
  { thrall: 0xff8080, enforcer: 0xff6060, spitter: 0xff4060 },
  { thrall: 'elder spawn', enforcer: 'blood knights', skeleton: 'the honored dead', spitter: 'blood wraiths' },
  {
    name: 'The Elder',
    base: 'vampire',
    look: { scale: 2.6, tint: 0xff9090, crown: true, cape: true, claws: true, orb: true, orbColor: 0xff2040, eyes: 0xff2020 },
    sheet: 'don',
    call: 'Approach the throne',
    again: 'Approach again',
    line: 'The Elder is awake.',
  },
  { fog: 0x200810, floor: 0x3a1a20, ground: 0x18060a, wall: 0x2a0e14, accent: 0xff2040, pattern: 'marble', wallStyle: 'stone' },
)

// Each map's own people and beasts (critters.ts loadCast). Kinds left out keep their usual model.
MOB.looks = { hound: 'shepherd' }
DOCKS.looks = { thug: 'dockhand', walker: 'drowned' }
MARKET.looks = { hound: 'stray', thug: 'barker', thrall: 'reveler' }
MANOR.looks = { thrall: 'servant' }
// Hunters in Ranger coats, bleached white; zealots in the Peasant outfit.
CATHEDRAL.looks = { thug: 'hunter', thrall: 'zealot' }
CATACOMBS.looks = { walker: 'tombfed' }

export const MAPS: Record<MapId, MapDef> = {
  slums: SLUMS,
  mob: MOB,
  docks: DOCKS,
  market: MARKET,
  wilds: WILDS,
  graves: GRAVES,
  manor: MANOR,
  cathedral: CATHEDRAL,
  catacombs: CATACOMBS,
  spire: SPIRE,
}

export function mapIndex(id: MapId): number {
  return MAP_IDS.indexOf(id)
}

/** True when a disc of `radius` fits in the zone's ground. */
export function inZone(zone: ZoneDef, x: number, z: number, radius = 0): boolean {
  if (inRooms(zone.rooms, x, z, radius)) return true
  return zone.pockets.some((p) => Math.hypot(x - p.x, z - p.z) <= p.r - radius)
}

/** The closest point in the zone where a disc of `radius` fits. */
export function nearestInZone(zone: ZoneDef, x: number, z: number, radius: number): { x: number; z: number } {
  if (inZone(zone, x, z, radius)) return { x, z }
  let bx = zone.start.x
  let bz = zone.start.z
  let best = Infinity
  const take = (px: number, pz: number) => {
    const d = (px - x) ** 2 + (pz - z) ** 2
    if (d < best) {
      best = d
      bx = px
      bz = pz
    }
  }
  for (const r of zone.rooms) {
    const minX = r.x0 + radius
    const maxX = r.x1 - radius
    const minZ = r.z0 + radius
    const maxZ = r.z1 - radius
    if (minX > maxX || minZ > maxZ) continue
    take(Math.min(maxX, Math.max(minX, x)), Math.min(maxZ, Math.max(minZ, z)))
  }
  for (const p of zone.pockets) {
    const max = p.r - radius
    if (max <= 0.15) continue
    const dx = x - p.x
    const dz = z - p.z
    const dist = Math.hypot(dx, dz) || 1
    const s = Math.min(dist, max) / dist
    take(p.x + dx * s, p.z + dz * s)
  }
  return { x: bx, z: bz }
}

/** Which map's ground a point is in, if any, by the nearest zone it sits inside. */
export function zoneAt(x: number, z: number): { map: MapId; zone: number } | null {
  for (const id of MAP_IDS) {
    const zones = MAPS[id].zones
    for (let i = 0; i < zones.length; i++) if (inZone(zones[i], x, z, -2)) return { map: id, zone: i }
  }
  return null
}
