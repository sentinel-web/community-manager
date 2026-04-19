import type { MemberId } from './shared';

export interface MemberProfile {
  name?: string;
  id?: number;
  roleId?: string;
  squadId?: string;
  rankId?: string;
  navyRankId?: string;
  specializationIds?: string[];
  medalIds?: string[];
  profilePictureId?: string;
  discordTag?: string;
  steamProfileLink?: string;
  description?: string;
  entryDate?: Date;
  exitDate?: Date;
  staticAttendancePoints?: number;
  staticInactivityPoints?: number;
  hasCustomArmour?: boolean;
}

export interface Member {
  _id: MemberId;
  username?: string;
  profile?: MemberProfile;
  createdAt?: Date;
}
