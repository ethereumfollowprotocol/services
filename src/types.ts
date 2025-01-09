export type Address = `0x${string}`

export type CountRow = {
  address: Address
  name: string
  avatar: string
  mutuals_rank: number
  followers_rank: number
  following_rank: number
  blocks_rank: number
  top8_rank: number
  mutuals: number
  followers: number
  following: number
  blocks: number
  top8: number
}

export type LeaderBoardRow = {
  address: Address
  name: string | undefined
  avatar: string | undefined
  mutuals_rank: number
  followers_rank: number
  following_rank: number
  blocks_rank: number
  top8_rank: number
  mutuals: number
  following: number
  followers: number
  blocks: number
  top8: number
}

export type MutualsRow = {
    address: Address
    mutuals_rank: number
    mutuals: number
}

export type RecentActivityRow = {
    address: Address
    name: string | undefined
    avatar: string | undefined
    following: number
    followers: number
    _index?: number | undefined
}

export type ENSProfile = {
  name: string
  address: Address
  avatar?: string
  records?: string
  contenthash?: string
  updated_at?: string
}

export type ENSProfileResponse = ENSProfile & { type: 'error' | 'success' }
