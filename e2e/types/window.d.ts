import type { Meteor as MeteorNS } from 'meteor/meteor';

declare global {
  interface Window {
    Meteor: typeof MeteorNS;
  }
}

export {};
