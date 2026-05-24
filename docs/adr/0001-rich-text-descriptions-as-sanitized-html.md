# 1. Rich-text descriptions stored as sanitized HTML

Date: 2026-05-24

## Status

Accepted

## Context

We are adding [[BriefingTemplate]]s: reusable rich-text blocks that members load into an event's `description`. This requires the event `description` and the template `content` to support formatted text (headings, lists, bold, links) rather than the plain `Input.TextArea` strings used today.

Storing formatted text forces a wire/storage format decision, and rendering user-authored markup back to *other* members is a stored-XSS vector. Our coding doctrine ranks **Security first**, so the format and the sanitization strategy are load-bearing and costly to change once real content exists (it becomes a data migration).

Three formats were considered:

- **Sanitized HTML** — richest WYSIWYG fit, largest XSS surface, opaque-ish in plain-text contexts (e.g. the logs before→after diff shows tags).
- **Markdown** — smaller XSS surface, human-readable in diffs, slightly less WYSIWYG.
- **Portable JSON (ProseMirror/Tiptap doc)** — most robust, but a JSON blob is opaque everywhere it isn't rendered and needs a renderer in every context.

For the editor itself: `react-quill` (unmaintained), its `react-quill-new` fork, or **Tiptap** (ProseMirror-based, actively maintained, strongly typed, extensible).

## Decision

1. **Store rich text as HTML strings.** The event `description` and the briefing-template `content` hold HTML.
2. **Edit with Tiptap (StarterKit)** via a single reusable editor component, used in exactly two places (the briefing-template form and the event form). All other `description` fields stay plain text.
3. **Sanitize at two points (defense in depth):** on the **server write path** (so MongoDB never persists hostile markup) and again at **client render** immediately before the HTML is injected into the DOM. Server-side sanitization runs through the existing `MutationWithAudit` choke point in the `events` and `briefingTemplates` insert/update bodies. The **allow-list itself is the single shared source of truth** (a library-agnostic list of tags/attributes/schemes); the server enforces it with **`sanitize-html`** (DOM-free, htmlparser2-based) and the client with **DOMPurify**. Two libraries, one policy.

   We initially specified DOMPurify+`jsdom` on the server, but `jsdom` is not bundler-safe under Meteor's rspack server build (it does runtime file reads and dynamic requires that break once bundled). `sanitize-html` needs no DOM and bundles cleanly, so it backs the server half while DOMPurify (the browser standard) backs the client half.
4. **Loading a template is a one-way copy (snapshot)** — see [[BriefingTemplate]] in `CONTEXT.md`. The event stores no `briefingTemplateId`.

## Consequences

- **Positive:** WYSIWYG authoring with minimal mapping (Tiptap emits/consumes HTML directly). A single sanitize-on-write step covers every write path; render-time sanitization protects any future render site and pre-existing dirty docs. No data migration: existing tag-free plain-text descriptions are valid, safe HTML.
- **Negative / costs:** New deps (Tiptap packages, `dompurify` on the client, `sanitize-html` on the server). Two sanitizer libraries instead of one — mitigated by the shared, library-agnostic allow-list. The logs before→after diff shows raw HTML tags for these two fields. Render sites must use the sanitize-then-inject helper, never raw injection — enforced by the project's security-reminder hook.
- **Reversal cost:** Moving to Markdown/JSON later means migrating stored HTML. Accepted, given HTML's authoring fit and the dual-sanitization safety net.
