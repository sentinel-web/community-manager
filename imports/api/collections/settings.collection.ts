import { Mongo } from 'meteor/mongo';
import type { SettingDoc } from '/imports/api/types';

const SettingsCollection = new Mongo.Collection<SettingDoc>('settings');

export default SettingsCollection;
