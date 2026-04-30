/* global describe, it */
import assert from 'node:assert';
import {
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateArray,
  validateArrayOfStrings,
  validateObject,
  validateUserId,
  validatePublish,
} from '../../server/main';

describe('validateUserId', () => {
  it('accepts a valid string userId', () => {
    assert.doesNotThrow(() => validateUserId('abc123'));
  });

  it('throws for null', () => {
    assert.throws(() => validateUserId(null));
  });

  it('throws for undefined', () => {
    assert.throws(() => validateUserId(undefined));
  });

  it('throws for empty string', () => {
    assert.throws(() => validateUserId(''));
  });

  it('throws for a number', () => {
    assert.throws(() => validateUserId(123));
  });
});

describe('validateString', () => {
  it('accepts a valid string when required', () => {
    assert.doesNotThrow(() => validateString('hello', false));
  });

  it('throws for empty string when required', () => {
    assert.throws(() => validateString('', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateString(null, false));
  });

  it('throws for number when required', () => {
    assert.throws(() => validateString(123, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateString(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateString(undefined, true));
  });

  it('accepts a valid string when optional', () => {
    assert.doesNotThrow(() => validateString('hello', true));
  });

  it('throws for number when optional', () => {
    assert.throws(() => validateString(123, true));
  });
});

describe('validateNumber', () => {
  it('accepts a valid number when required', () => {
    assert.doesNotThrow(() => validateNumber(42, false));
  });

  it('accepts zero when required', () => {
    assert.doesNotThrow(() => validateNumber(0, false));
  });

  it('throws for string when required', () => {
    assert.throws(() => validateNumber('42', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateNumber(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateNumber(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateNumber(undefined, true));
  });

  it('throws for string when optional', () => {
    assert.throws(() => validateNumber('42', true));
  });
});

describe('validateBoolean', () => {
  it('accepts true when required', () => {
    assert.doesNotThrow(() => validateBoolean(true, false));
  });

  it('accepts false when required', () => {
    assert.doesNotThrow(() => validateBoolean(false, false));
  });

  it('throws for string when required', () => {
    assert.throws(() => validateBoolean('true', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateBoolean(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateBoolean(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateBoolean(undefined, true));
  });

  it('throws for string when optional', () => {
    assert.throws(() => validateBoolean('true', true));
  });
});

describe('validateDate', () => {
  it('accepts a Date object when required', () => {
    assert.doesNotThrow(() => validateDate(new Date(), false));
  });

  it('throws for string when required', () => {
    assert.throws(() => validateDate('2024-01-01', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateDate(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateDate(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateDate(undefined, true));
  });

  it('throws for string when optional', () => {
    assert.throws(() => validateDate('2024-01-01', true));
  });
});

describe('validateArray', () => {
  it('accepts an array when required', () => {
    assert.doesNotThrow(() => validateArray([1, 2, 3], false));
  });

  it('accepts an empty array when required', () => {
    assert.doesNotThrow(() => validateArray([], false));
  });

  it('throws for string when required', () => {
    assert.throws(() => validateArray('not-an-array', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateArray(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateArray(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateArray(undefined, true));
  });

  it('throws for string when optional', () => {
    assert.throws(() => validateArray('not-an-array', true));
  });
});

describe('validateArrayOfStrings', () => {
  it('accepts an array of strings when required', () => {
    assert.doesNotThrow(() => validateArrayOfStrings(['a', 'b'], false));
  });

  it('accepts an empty array when required', () => {
    assert.doesNotThrow(() => validateArrayOfStrings([], false));
  });

  it('throws for array with non-strings when required', () => {
    assert.throws(() => validateArrayOfStrings(['a', 123], false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateArrayOfStrings(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateArrayOfStrings(null, true));
  });

  it('throws for array with non-strings when optional', () => {
    assert.throws(() => validateArrayOfStrings(['a', 123], true));
  });
});

describe('validateObject', () => {
  it('accepts an object when required', () => {
    assert.doesNotThrow(() => validateObject({ key: 'value' }, false));
  });

  it('accepts an empty object when required', () => {
    assert.doesNotThrow(() => validateObject({}, false));
  });

  it('throws for string when required', () => {
    assert.throws(() => validateObject('not-an-object', false));
  });

  it('throws for null when required', () => {
    assert.throws(() => validateObject(null, false));
  });

  it('accepts null when optional', () => {
    assert.doesNotThrow(() => validateObject(null, true));
  });

  it('accepts undefined when optional', () => {
    assert.doesNotThrow(() => validateObject(undefined, true));
  });

  it('throws for string when optional', () => {
    assert.throws(() => validateObject('not-an-object', true));
  });
});

describe('validatePublish', () => {
  it('accepts valid userId, filter, and options', () => {
    assert.doesNotThrow(() => validatePublish('userId123', {}, {}));
  });

  it('throws for invalid userId', () => {
    assert.throws(() => validatePublish(null, {}, {}));
  });

  it('throws for invalid filter', () => {
    assert.throws(() => validatePublish('userId123', 'bad', {}));
  });

  it('throws for invalid options', () => {
    assert.throws(() => validatePublish('userId123', {}, 'bad'));
  });
});
