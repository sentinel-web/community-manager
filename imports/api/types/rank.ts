export type RankType = 'player' | 'zeus';

export interface Rank {
  _id?: string;
  name: string;
  type: RankType;
  color?: string;
  previousRankId?: string;
  nextRankId?: string;
  description?: string;
}
