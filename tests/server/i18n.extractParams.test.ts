import assert from 'node:assert';
import { extractParams, type ExtractParams } from '../../imports/i18n/extract-params';

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type _NoPlaceholders = Expect<Equal<ExtractParams<'plain text'>, {}>>;
type _Empty = Expect<Equal<ExtractParams<''>, {}>>;
type _Single = Expect<Equal<ExtractParams<'Hello {{name}}'>, { name: string | number }>>;
type _Multiple = Expect<Equal<ExtractParams<'{{a}} and {{b}}'>, { a: string | number; b: string | number }>>;
type _Duplicates = Expect<Equal<ExtractParams<'{{a}} {{a}}'>, { a: string | number }>>;
type _LeadingTrailing = Expect<Equal<ExtractParams<'{{first}} middle {{last}}'>, { first: string | number; last: string | number }>>;

describe('extractParams', () => {
  it('returns an empty set for an empty string', () => {
    assert.deepEqual([...extractParams('')], []);
  });

  it('returns an empty set when there are no placeholders', () => {
    assert.deepEqual([...extractParams('Hello world')], []);
  });

  it('extracts a single placeholder', () => {
    assert.deepEqual([...extractParams('Hello {{name}}')], ['name']);
  });

  it('extracts multiple placeholders preserving order of first occurrence', () => {
    assert.deepEqual([...extractParams('{{a}} and {{b}}')], ['a', 'b']);
  });

  it('collapses duplicate placeholders into a single entry', () => {
    assert.deepEqual([...extractParams('{{a}} {{a}} {{a}}')], ['a']);
  });

  it('handles placeholders at the start and end of the string', () => {
    assert.deepEqual([...extractParams('{{first}} middle {{last}}')], ['first', 'last']);
  });

  it('ignores malformed placeholders', () => {
    assert.deepEqual([...extractParams('{name} and {{ }} and {{!@#}}')], []);
  });

  it('returns a Set (not an array) so callers can compare via deepEqual', () => {
    const result = extractParams('{{a}}');
    assert.ok(result instanceof Set);
  });
});
