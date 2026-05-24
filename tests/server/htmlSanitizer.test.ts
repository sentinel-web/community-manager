import assert from 'node:assert';
import { sanitizeHtml } from '../../server/htmlSanitizer';

describe('sanitizeHtml (server)', () => {
  describe('strips dangerous markup', () => {
    it('removes <script> tags', () => {
      const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
      assert.ok(!out.includes('<script'), `script tag survived: ${out}`);
      assert.ok(!out.includes('alert(1)'), `script body survived: ${out}`);
      assert.ok(out.includes('<p>hi</p>'));
    });

    it('removes event-handler attributes', () => {
      const out = sanitizeHtml('<p onclick="steal()">x</p><img src=x onerror="hack()">');
      assert.ok(!/onclick/i.test(out), `onclick survived: ${out}`);
      assert.ok(!/onerror/i.test(out), `onerror survived: ${out}`);
    });

    it('strips javascript: URLs from links', () => {
      const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
      assert.ok(!/javascript:/i.test(out), `javascript: URL survived: ${out}`);
    });

    it('removes <iframe> elements', () => {
      const out = sanitizeHtml('<iframe src="https://evil.example"></iframe><p>ok</p>');
      assert.ok(!/<iframe/i.test(out), `iframe survived: ${out}`);
      assert.ok(out.includes('<p>ok</p>'));
    });

    it('removes <img> (not on the allow-list)', () => {
      const out = sanitizeHtml('<p>a</p><img src="https://evil.example/x.png">');
      assert.ok(!/<img/i.test(out), `img survived: ${out}`);
    });
  });

  describe('preserves benign formatting', () => {
    it('keeps headings, bold, italics and lists', () => {
      const input = '<h2>Mission</h2><p><strong>bold</strong> <em>italic</em></p><ul><li>one</li><li>two</li></ul>';
      const out = sanitizeHtml(input);
      assert.ok(out.includes('<h2>Mission</h2>'));
      assert.ok(out.includes('<strong>bold</strong>'));
      assert.ok(out.includes('<em>italic</em>'));
      assert.ok(out.includes('<li>one</li>'));
      assert.ok(out.includes('<li>two</li>'));
    });

    it('keeps anchor links with a safe href', () => {
      const out = sanitizeHtml('<a href="https://example.com">link</a>');
      assert.ok(out.includes('href="https://example.com"'), `safe href dropped: ${out}`);
      assert.ok(out.includes('>link</a>'));
    });

    it('keeps blockquote, code and pre', () => {
      const out = sanitizeHtml('<blockquote>q</blockquote><pre><code>x</code></pre>');
      assert.ok(out.includes('<blockquote>q</blockquote>'));
      assert.ok(out.includes('<pre>'));
      assert.ok(out.includes('<code>x</code>'));
    });
  });

  describe('handles edge inputs', () => {
    it('returns empty string for non-string input', () => {
      assert.strictEqual(sanitizeHtml(undefined), '');
      assert.strictEqual(sanitizeHtml(null), '');
      assert.strictEqual(sanitizeHtml(42), '');
    });

    it('returns empty string for an empty string', () => {
      assert.strictEqual(sanitizeHtml(''), '');
    });

    it('passes plain text through unchanged (legacy descriptions)', () => {
      assert.strictEqual(sanitizeHtml('just plain text'), 'just plain text');
    });
  });
});
