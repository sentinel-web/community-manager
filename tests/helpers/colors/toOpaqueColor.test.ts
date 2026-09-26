import assert from 'node:assert';
import toOpaqueColor from '../../../imports/helpers/colors/toOpaqueColor';

// The painted background and the background the text color is measured from must be the same value.
// Colors stored before ColorPicker alpha was disabled still carry an alpha channel (#rrggbbaa), which
// antd paints translucent while the luminance maths would read it as fully opaque.
describe('toOpaqueColor', () => {
  it('returns colors without alpha unchanged', () => {
    assert.strictEqual(toOpaqueColor('#ffffff'), '#ffffff');
    assert.strictEqual(toOpaqueColor('#abc'), '#abc');
    assert.strictEqual(toOpaqueColor('  #123456  '), '#123456');
  });

  it('drops the alpha channel from 8-digit hex', () => {
    assert.strictEqual(toOpaqueColor('#ffffff40'), '#ffffff');
    assert.strictEqual(toOpaqueColor('#00000080'), '#000000');
  });

  it('drops the alpha channel from 4-digit hex', () => {
    assert.strictEqual(toOpaqueColor('#f008'), '#ff0000');
  });

  it('drops the alpha channel from rgba()', () => {
    assert.strictEqual(toOpaqueColor('rgba(255, 214, 102, 0.25)'), '#ffd666');
    assert.strictEqual(toOpaqueColor('rgb(0, 0, 0)'), '#000000');
  });

  it('returns undefined for empty or unparseable colors', () => {
    assert.strictEqual(toOpaqueColor(''), undefined);
    assert.strictEqual(toOpaqueColor(null), undefined);
    assert.strictEqual(toOpaqueColor(undefined), undefined);
    assert.strictEqual(toOpaqueColor('lightgray'), undefined);
    assert.strictEqual(toOpaqueColor('#ggg'), undefined);
  });
});
