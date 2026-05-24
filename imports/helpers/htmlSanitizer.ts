import DOMPurify from 'dompurify';
import { ALLOWED_ATTR, ALLOWED_TAGS } from '/imports/api/htmlSanitizer/sanitizePolicy';

/**
 * Client-side rich-text sanitizer, run immediately before HTML is rendered to
 * the DOM (the render-path half of the defence-in-depth strategy in ADR 0001).
 * Uses the browser's native window and the shared allow-list, so it strips to
 * the exact same tag/attribute set the server enforces on write.
 */
export default function sanitizeHtml(dirty: unknown): string {
  if (typeof dirty !== 'string' || dirty.length === 0) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
  });
}
