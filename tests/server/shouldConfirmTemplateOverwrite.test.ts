import assert from 'node:assert';
import shouldConfirmTemplateOverwrite from '../../imports/helpers/shouldConfirmTemplateOverwrite';

describe('shouldConfirmTemplateOverwrite', () => {
  it('does not confirm for null/undefined', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite(undefined), false);
    assert.strictEqual(shouldConfirmTemplateOverwrite(null), false);
  });

  it('does not confirm for an empty string', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite(''), false);
  });

  it('does not confirm for the empty-editor paragraph', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite('<p></p>'), false);
  });

  it('does not confirm for whitespace-only / &nbsp; markup', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite('<p>   </p>'), false);
    assert.strictEqual(shouldConfirmTemplateOverwrite('<p>&nbsp;</p>'), false);
    assert.strictEqual(shouldConfirmTemplateOverwrite('<p><br></p>'), false);
  });

  it('confirms when the editor holds real text', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite('<p>hello</p>'), true);
  });

  it('confirms for formatted content (headings, lists)', () => {
    assert.strictEqual(shouldConfirmTemplateOverwrite('<h2>Mission</h2><ul><li>one</li></ul>'), true);
  });
});
