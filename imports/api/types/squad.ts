export interface Squad {
  _id?: string;
  name: string;
  color?: string;
  image?: string;
  parentSquadId?: string;
  shortRangeFrequency?: string;
  longRangeFrequency?: string;
  description?: string;
  excludeFromOrbat?: boolean;
}
