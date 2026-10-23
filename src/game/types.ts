export type Stat =
  | 'strength'
  | 'fortitude'
  | 'agility'
  | 'sorcery'
  | 'resistance'
  | 'vitality'

export type Slot = 'weapon' | 'cape' | 'coat' | 'boots'

export type SkillId = 'bats' | 'drain' | 'dash' | 'nova'

export type EnemyKind = 'ghoul' | 'rat' | 'wolf' | 'witch' | 'boss' | 'thug' | 'enforcer' | 'don'

export const STATS: Stat[] = [
  'strength',
  'fortitude',
  'agility',
  'sorcery',
  'resistance',
  'vitality',
]

export const SLOTS: Slot[] = ['weapon', 'cape', 'coat', 'boots']

export const SKILLS: SkillId[] = ['bats', 'drain', 'dash', 'nova']

export interface SaveData {
  v: 1
  blood: number
  stacks: Record<Stat, number>
  gear: Record<Slot, number>
  evolved: Record<Slot, boolean>
  level: number
  xp: number
  kills: number
  bossKills: number
  /** Kills in the mob district. The Slums boss still keys off `kills`. */
  mobKills: number
  donKills: number
  killRate: number
  lastActiveAt: number
  muted: boolean
  seenHint: boolean
}

export interface OfflineReport {
  seconds: number
  capped: boolean
  feeds: number
  blood: number
  xp: number
  levels: number
  strength: number
  agility: number
  vitality: number
  sorcery: number
}
