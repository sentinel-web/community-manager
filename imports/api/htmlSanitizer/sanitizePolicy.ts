/**
 * The single allow-list policy shared by the server (sanitize-html) and client
 * (DOMPurify) sanitizers — see docs/adr/0001-rich-text-descriptions-as-sanitized-html.md.
 *
 * These are plain, library-agnostic data so the two enforcers can never drift on
 * what is allowed. The allowed tags mirror what the Tiptap StarterKit editor can
 * produce; only a minimal, safe attribute set is permitted. Dangerous URL schemes
 * (e.g. `javascript:`) are rejected by both libraries' default scheme handling.
 */
export const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'a',
  'span',
] as const;

export const ALLOWED_ATTR = ['href', 'target', 'rel'] as const;

/** URL schemes permitted on `href`. Anything else (javascript:, data:, …) is dropped. */
export const ALLOWED_SCHEMES = ['http', 'https', 'mailto'] as const;
