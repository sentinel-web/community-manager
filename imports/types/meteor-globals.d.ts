declare global {
  namespace Meteor {
    interface User {
      _id: string;
      username?: string;
      profile?: Record<string, unknown>;
      createdAt?: Date;
    }
  }
}

export {};
