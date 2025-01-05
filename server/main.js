import { Meteor } from 'meteor/meteor';
import './apis/members.server';
import './apis/events.server';
import './apis/tasks.server';
import './apis/settings.server';
import './apis/registrations.server';
import './apis/profilePictures.server';
import './apis/discoveryTypes.server';
import './apis/taskStatus.server';
import './apis/ranks.server';
import './apis/specializations.server';
import './apis/squads.server';

export function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Meteor.Error('validateUserId', 'not-authorized', JSON.stringify(userId));
  }
}

function validateOptionalString(string) {
  if (string && typeof string !== 'string') {
    throw new Meteor.Error('validateOptionalString', 'Invalid string', JSON.stringify(string));
  }
}

function validateRequiredString(string) {
  if (!string || typeof string !== 'string') {
    throw new Meteor.Error('validateRequiredString', 'Invalid string', JSON.stringify(string));
  }
}

export function validateString(string, optional) {
  if (optional) {
    validateOptionalString(string);
  } else {
    validateRequiredString(string);
  }
}

function validateOptionalNumber(number) {
  if (number && typeof number !== 'number') {
    throw new Meteor.Error('validateOptionalNumber', 'Invalid number', JSON.stringify(number));
  }
}

function validateRequiredNumber(number) {
  if (!number || typeof number !== 'number') {
    throw new Meteor.Error('validateRequiredNumber', 'Invalid number', JSON.stringify(number));
  }
}

export function validateNumber(number, optional) {
  if (optional) {
    validateOptionalNumber(number);
  } else {
    validateRequiredNumber(number);
  }
}

function validateOptionalBoolean(boolean) {
  if (boolean && typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateOptionalBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

function validateRequiredBoolean(boolean) {
  if (!boolean || typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateRequiredBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

export function validateBoolean(boolean, optional) {
  if (optional) {
    validateOptionalBoolean(boolean);
  } else {
    validateRequiredBoolean(boolean);
  }
}

function validateOptionalDate(date) {
  if (date && typeof date !== 'object') {
    throw new Meteor.Error('validateOptionalDate', 'Invalid date', JSON.stringify(date));
  }
}

function validateRequiredDate(date) {
  if (!date || typeof date !== 'object') {
    throw new Meteor.Error('validateRequiredDate', 'Invalid date', JSON.stringify(date));
  }
}

export function validateDate(date, optional) {
  if (optional) {
    validateOptionalDate(date);
  } else {
    validateRequiredDate(date);
  }
}

function validateOptionalArray(array) {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArray', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArray(array) {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArray', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArray(array, optional) {
  if (optional) {
    validateOptionalArray(array);
  } else {
    validateRequiredArray(array);
  }
}

function validateOptionalArrayOfStrings(array) {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArrayOfStrings(array) {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArrayOfStrings(array, optional) {
  if (optional) {
    validateOptionalArrayOfStrings(array);
  } else {
    validateRequiredArrayOfStrings(array);
  }
}

function validateOptionalObject(object) {
  if (object && typeof object !== 'object') {
    throw new Meteor.Error('validateOptionalObject', 'Invalid object', JSON.stringify(object));
  }
}

function validateRequiredObject(object) {
  if (!object || typeof object !== 'object') {
    throw new Meteor.Error('validateRequiredObject', 'Invalid object', JSON.stringify(object));
  }
}

export function validateObject(object, optional) {
  if (optional) {
    validateOptionalObject(object);
  } else {
    validateRequiredObject(object);
  }
}

export function validatePublish(userId, filter, options) {
  validateUserId(userId);
  validateObject(filter, true);
  validateObject(options, true);
}
