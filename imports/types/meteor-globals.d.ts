declare module 'meteor/mongo' {
  namespace Mongo {
    interface Collection<T, U = T> {
      countDocuments(selector?: Selector<T> | Record<string, unknown>): Promise<number>;
    }
  }
}

declare module 'meteor/meteor' {
  namespace Meteor {
    interface UserProfile {
      name?: string;
      id?: number;
      roleId?: string;
      squadId?: string;
      rankId?: string;
      navyRankId?: string;
      specializationIds?: string[];
      medalIds?: string[];
      positionId?: string;
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
  }
}
