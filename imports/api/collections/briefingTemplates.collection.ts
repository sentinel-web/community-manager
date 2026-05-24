import { Mongo } from 'meteor/mongo';
import type { BriefingTemplate } from '/imports/api/types';

const BriefingTemplatesCollection = new Mongo.Collection<BriefingTemplate>('briefingTemplates');

export default BriefingTemplatesCollection;
