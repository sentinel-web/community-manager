# Rich Text & HTML Sanitization

The dual-sanitization pipeline behind the app's only two rich-text fields — the briefing-template `content` and the event `description`. One library-agnostic allow-list is enforced twice (server write path + client render path) so the database never stores hostile markup and the DOM never receives it.

## Key files

- `imports/api/htmlSanitizer/sanitizePolicy.ts` — the single shared, library-agnostic allow-list (`ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_SCHEMES`). Both enforcers import from here.
- `server/htmlSanitizer.ts` — server write-path sanitizer (`sanitizeHtml`) backed by `sanitize-html` (DOM-free, htmlparser2-based).
- `imports/helpers/htmlSanitizer.ts` — client render-path sanitizer (`sanitizeHtml`, default export) backed by DOMPurify.
- `server/crud.lib.ts` — `HTML_FIELDS` map + `sanitizeHtmlFields()`, which runs the server sanitizer on the rich-text fields of `events` and `briefingTemplates` on every insert/update.
- `imports/ui/components/RichTextEditor.tsx` — controlled Tiptap StarterKit editor that drops into an antd `<Form.Item>` (reads `value`, emits HTML via `onChange`).
- `imports/ui/components/RichTextView.tsx` — read-only renderer: client-sanitizes, then feeds a non-editable Tiptap instance (no raw HTML injection).
- `imports/helpers/shouldConfirmTemplateOverwrite.ts` — decides whether loading a template over an event description needs a confirm dialog.
- `imports/ui/briefing-templates/BriefingTemplatesForm.tsx` — authoring form for template `content`.
- `imports/ui/events/EventForm.tsx` — event form; hosts the `BriefingTemplatePicker` that snapshot-copies a template into the description.
- `docs/adr/0001-rich-text-descriptions-as-sanitized-html.md` — the decision record (format, libraries, defense-in-depth).

## How it works

### The two rich-text surfaces

Rich text exists in exactly two places. Every other `description` field in the app is plain text (`Input` / `Input.TextArea`).

| Collection | Field | Authoring form | Note field (plain text) |
|------------|-------|----------------|-------------------------|
| `briefingTemplates` | `content` | `BriefingTemplatesForm.tsx` | `description` (short list note) |
| `events` | `description` | `EventForm.tsx` | — |

The server-side source of truth for which fields are rich text is `HTML_FIELDS` in `server/crud.lib.ts:89`:

```ts
const HTML_FIELDS: Partial<Record<CrudCollectionName, readonly string[]>> = {
  briefingTemplates: ['content'],
  events: ['description'],
};
```

This is kept as inline code (not a `COLLECTION_REGISTRY` field) under the Rule of Three — only two collections vary, so it stays code until a third appears.

### One allow-list, two enforcers

`sanitizePolicy.ts` exports plain data — no library types — so the two sanitizers can never drift on what is permitted. The allowed tags mirror what the Tiptap StarterKit editor can produce.

| Constant | Value | Used by |
|----------|-------|---------|
| `ALLOWED_TAGS` | `p br hr strong b em i u s strike h1–h6 ul ol li blockquote code pre a span` | server + client |
| `ALLOWED_ATTR` | `href target rel` | server + client |
| `ALLOWED_SCHEMES` | `http https mailto` | server only (`allowedSchemes`) |

Dangerous URL schemes (`javascript:`, `data:`, …) are rejected by both libraries' default scheme handling; the server additionally pins the explicit `ALLOWED_SCHEMES` list. DOMPurify is configured only with `ALLOWED_TAGS` + `ALLOWED_ATTR` and relies on its built-in scheme defenses.

### Why sanitize twice (defense in depth)

The two passes guard different threats, per ADR 0001:

| Pass | File | Library | When | Guarantees |
|------|------|---------|------|------------|
| Write | `server/htmlSanitizer.ts` | `sanitize-html` | before MongoDB write | DB never persists hostile markup, regardless of which path wrote it |
| Render | `imports/helpers/htmlSanitizer.ts` | DOMPurify | immediately before DOM | protects any render site and any pre-existing dirty doc, even bypassing the write pass |

Different libraries are deliberate. The original plan was DOMPurify + `jsdom` on the server, but `jsdom` is not bundler-safe under Meteor's rspack server build (runtime file reads + dynamic requires break once bundled). `sanitize-html` needs no DOM and bundles cleanly. Two libraries, one policy.

Both `sanitizeHtml` functions guard their input identically: non-string or empty input returns `''`.

`server/htmlSanitizer.ts` options of note:

| Option | Value | Effect |
|--------|-------|--------|
| `allowedTags` | `[...ALLOWED_TAGS]` | drops any tag not on the list |
| `allowedAttributes` | `{ '*': [...ALLOWED_ATTR] }` | only `href`/`target`/`rel`, on any element |
| `allowedSchemes` | `[...ALLOWED_SCHEMES]` | `href` must be `http`/`https`/`mailto` |
| `disallowedTagsMode` | `'discard'` | drops disallowed tags **and their content** (e.g. `<script>…</script>` vanishes entirely, not escaped) |

### Data flow

```
Author types in RichTextEditor (Tiptap StarterKit) ──onChange(HTML)──▶ antd Form value
        │
        ▼ Meteor method (events.insert/update | briefingTemplates.insert/update)
   runMutation → body → sanitizeHtmlFields() [server/htmlSanitizer.ts, sanitize-html]
        │
        ▼ stored as sanitized HTML in MongoDB (events.description | briefingTemplates.content)
        │
        ▼ read back
   RichTextView: sanitizeHtml() [imports/helpers, DOMPurify] → non-editable Tiptap → EditorContent
```

Server sanitization rides the standard mutation lifecycle — `sanitizeHtmlFields()` is invoked inside the generic `.insert` (`crud.lib.ts:218`) and `.update` (`crud.lib.ts:250`) bodies, which run through `runMutation`. There is no per-collection custom method for this; it is the shared CRUD factory.

### Editor and renderer (Tiptap)

`RichTextEditor` is a controlled antd-shaped component (`value` / `onChange`), so it slots into `<Form.Item name="content">` like an `<Input>`:
- Tiptap renders an empty document as `<p></p>`; `normalize()` (`RichTextEditor.tsx:35`) maps that to `''` so an untouched editor never persists phantom markup.
- External value changes (edit-mode init, template load) are applied via `editor.commands.setContent(incoming, { emitUpdate: false })` so updating from outside does not re-fire `onChange` and clobber caller state (`RichTextEditor.tsx:52`).
- `immediatelyRender: false` is set for SSR/hydration safety.
- The toolbar exposes bold, italic, strike, H2, H3, bullet list, ordered list, undo, redo (a subset of StarterKit).

`RichTextView` renders stored HTML **without ever injecting raw HTML into the DOM**: it client-sanitizes the input, then hands it to a non-editable Tiptap instance, which only renders nodes its schema recognizes (a third implicit filter). It returns `null` for empty/clean-empty content. Used today only in `imports/ui/events/EventDetailPopover.tsx`.

### One-way template snapshot

Loading a briefing template into an event is a **one-way copy**, not a link (see `CONTEXT.md` → BriefingTemplate). The `BriefingTemplatePicker` inside `EventForm.tsx` copies the template's `content` into the event's `description` form field:

```ts
form.setFieldsValue({ description: content });   // EventForm.tsx applyTemplate
```

The event keeps **no `briefingTemplateId`** — editing a template later never propagates to events already created from it, and the copied description is freely editable afterward.

`shouldConfirmTemplateOverwrite(currentHtml)` gates a confirm dialog so a load never silently destroys existing work:

| Input | Result | Reason |
|-------|--------|--------|
| `null` / `undefined` / `''` | `false` (load silently) | nothing to lose |
| `<p></p>`, `<br>`, whitespace, `&nbsp;` | `false` | empty-editor markup carries no real content |
| any real text after stripping tags + `&nbsp;` | `true` (confirm first) | would overwrite real content |

It strips tags (`/<[^>]*>/g`), replaces `&nbsp;` with a space, trims, and confirms only if non-empty text remains.

## Gotchas

- **Don't add a third rich-text field by accident.** Every `description` field except the event's is plain text. To make a field rich text you must add it to `HTML_FIELDS` in `crud.lib.ts` *and* swap its form control to `RichTextEditor` *and* render it via `RichTextView`. Adding rich-text markup to demo/seed data (event `description`, template `content`) must use only tags on the allow-list (`sanitizePolicy.ts`) — see `CLAUDE.md` Demo Data note.
- **Never inject raw HTML.** Render sites must go through the sanitize-then-inject path (`RichTextView`, which uses DOMPurify then Tiptap). No `dangerouslySetInnerHTML` exists in the codebase; the project's security-reminder hook flags raw injection.
- **Provide editor content via `initialValues`, not a `setFieldsValue` effect.** `RichTextEditor` initializes its document from `value` on first render; a deferred `useEffect` would race the editor's lifecycle and lose content. `BriefingTemplatesForm` builds a synchronous `model` via `useMemo` for exactly this reason (`BriefingTemplatesForm.tsx:28`).
- **The allow-list is shared and library-agnostic on purpose.** Edit it in one place (`sanitizePolicy.ts`); never hard-code tags in `server/htmlSanitizer.ts` or `imports/helpers/htmlSanitizer.ts`, or the two enforcers will silently diverge.
- **Server uses `sanitize-html`, not DOMPurify + jsdom.** jsdom is not bundler-safe under Meteor's rspack server build. Don't "unify" the two sanitizers onto one library without solving that.
- **`disallowedTagsMode: 'discard'` drops content, not just tags.** A `<script>payload</script>` removes the payload too; tests in `tests/server/htmlSanitizer.test.ts` assert this.
- **Logs show raw HTML for these two fields.** The audit before→after diff renders tags literally for `events.description` and `briefingTemplates.content` (an accepted cost of the HTML format).
- **Empty-editor markup is not empty content.** Tiptap emits `<p></p>` for an untouched editor; `RichTextEditor` normalizes it to `''`, and `shouldConfirmTemplateOverwrite` treats `<br>`/whitespace/`&nbsp;` as empty. Don't compare raw editor HTML to `''` directly.

## See also

- `CONTEXT.md` → **BriefingTemplate** — the snapshot-copy doctrine and field shapes.
- `CONTEXT.md` → **MutationWithAudit** — the server mutation lifecycle the write-path sanitizer rides on.
- `docs/adr/0001-rich-text-descriptions-as-sanitized-html.md` — the full decision (HTML vs Markdown vs JSON, Tiptap, dual sanitization, library choice).
- `docs/collections.md` — field schemas for `events` and `briefingTemplates`.
- `docs/views-and-forms.md` — where the editor/viewer surfaces appear in the UI.
- `tests/server/htmlSanitizer.test.ts`, `tests/server/eventsDescriptionSanitize.test.ts`, `tests/server/briefingTemplatesMethods.test.ts` — sanitize-on-write coverage.
