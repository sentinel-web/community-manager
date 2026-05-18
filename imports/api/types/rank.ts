export type RankType = 'player' | 'zeus';

export interface Rank {
  discordRoleId?: string;
  _id?: string;
  name: string;
  type: RankType;
  color?: string;
  previousRankId?: string;
  nextRankId?: string;
  description?: string;
}
