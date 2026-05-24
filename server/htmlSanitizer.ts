import sanitizeHtmlLib from 'sanitize-html';
import { ALLOWED_ATTR, ALLOWED_SCHEMES, ALLOWED_TAGS } from '/imports/api/htmlSanitizer/sanitizePolicy';

/**
 * Server-side rich-text sanitizer. This is the write-path half of the
 * defence-in-depth strategy in ADR 0001: every rich-text field is sanitized here
 * before it reaches MongoDB, so the database never stores hostile markup
 * regardless of the render path.
 *
 * Uses sanitize-html (DOM-free, htmlparser2-based) rather than DOMPurify+jsdom,
 * because jsdom is not bundler-safe under Meteor's rspack server build. The
 * allow-list is the shared, library-agnostic policy, so the server strips to the
 * exact same tag/attribute set the client DOMPurify pass enforces.
 */
const OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: { '*': [...ALLOWED_ATTR] },
  allowedSchemes: [...ALLOWED_SCHEMES],
  // Drop, rather than escape, disallowed tags' content (e.g. <script>…</script>).
  disallowedTagsMode: 'discard',
};

export function sanitizeHtml(dirty: unknown): string {
  if (typeof dirty !== 'string' || dirty.length === 0) return '';
  return sanitizeHtmlLib(dirty, OPTIONS);
}

export default sanitizeHtml;
