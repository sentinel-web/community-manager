declare module 'meteor/mongo' {
  namespace Mongo {
    interface Collection<T, U = T> {
      countDocuments(selector?: Selector<T> | Record<string, unknown>): Promise<number>;
    }
  }
}

declare module 'meteor/meteor' {
  namespace Meteor {
    // Broaden Meteor.Error.details from `string` (per @types/meteor) to
    // `unknown` so structured-details errors (e.g. `foreign_key_blocked`'s
    // { blockedBy: [...] } payload) typecheck. EJSON serializes the details
    // verbatim across DDP, matching Meteor's actual runtime contract.
    interface ErrorStatic {
      new (error: string | number, reason?: string, details?: unknown): Error;
    }
    interface Error {
      details?: unknown;
    }

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
      taskFilter?: Record<string, unknown>;
    }
  }
}
