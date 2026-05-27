# Project Context

Project-wide domain language and load-bearing decisions. ADRs go in `docs/adr/`. Per-area docs live in `docs/agents/`.

## Domain terms

### BriefingTemplate

A reusable, named block of rich-text content that members load into an **event description** to seed a briefing. Stored in its own simple-CRUD collection (`briefingTemplates`), shape `{ name, color, content, description }` where `content` is the rich-text body (sanitized HTML) and `description` is a short plain-text note shown in the templates list. Rides on a new `briefingTemplates` permission module.

Loading a template into an event is a **one-way copy (snapshot)**: the template's `content` is copied into the event's `description` at load time and is freely editable afterward. The event keeps no reference to the template, and editing a template never propagates to past events. There is intentionally no `briefingTemplateId` on the event.

Rich text is stored as **sanitized HTML** and sanitized at two points — on the server write path (so Mongo never holds hostile markup) and again at client render, immediately before the HTML is injected into the DOM. A single library-agnostic allow-list (`imports/api/htmlSanitizer/sanitizePolicy.ts`) is the shared source of truth; the server enforces it with `sanitize-html` and the client with DOMPurify. Only two surfaces are rich text: the briefing-template `content` and the event `description`. Every other collection's `description` stays plain text.

### MutationWithAudit

The single deep module (`server/mutation-pipeline.ts`) that owns the standard server-mutation lifecycle. Lifecycle stages, in order:

1. **Authentication** — reject anonymous calls with `Meteor.Error(401, …)` unless the descriptor opts in via `allowAnonymous`.
2. **Permission check** — `checkPermission(userId, module, op)` against the descriptor's `permissionModule`. An optional unconditional `fallbackFlag` (e.g. `canCreateEvents`) re-admits a denied call when set on the user's role.
3. **Input shape validation** — the descriptor's `validate(args)` callback, where each method declares its own `validateString` / `validateObject` / `validateArrayOfStrings` shape checks.
4. **Body invocation** — the unique mutation step the caller supplies as `(args) => Promise<TResult>`.
5. **Audit log emission** — on success only. Standard shapes per op (`insert → { id, ...payload }`, `update → { id, changes }`, `remove → { id }`) are baked in; the descriptor can pass `audit: (args, result) => ({...})` to opt into a custom shape.

On any pre-body failure (auth, permission, validation), the wrapper emits a `<collection>.<op>.denied` audit entry capturing `userId` (and the target `id` for `update`/`remove`) before throwing — closing the previous gap where permission denials produced no audit trail. Body errors propagate untouched: the wrapper does **not** normalize, wrap, or translate them. A body throwing `Meteor.Error('SomeCode', '...')` reaches the caller with `error.error === 'SomeCode'` intact.

The wrapper is exposed as `runMutation(ctx, descriptor, args, body)` with an explicit `ctx` parameter (carrying `userId`), which lets unit tests invoke the lifecycle directly without `Meteor.callAsync`. Both call paths — `createCollectionMethods` (the CRUD factory in `server/crud.lib.ts`) and direct `runMutation` calls from custom methods that opt in — route through the same internal pipeline, so the lifecycle has exactly one implementation regardless of entry door.

### CollectionPermissionRegistry

The single source of per-collection metadata that both the CRUD factory and the `MutationWithAudit` wrapper consult. Lives in `server/collection-registry.ts` as a typed `Record<CrudCollectionName, CollectionRegistryEntry>` — one entry per collection with these fields:

- `module` — the permission module name used for `checkPermission`. Several collections (e.g. `attendances`, `profilePictures`, `questionnaireResponses`) do not own a permission module of their own; they ride on a parent module's permissions, encoded here.
- `fallback` (optional) — unconditional special-permission flag per `create` / `update` op, e.g. `canCreateEvents` for `events.create` or `canManageTasks` for `tasks.{create,update}`. When set, possession of the flag re-admits a denied call.
- `allowsAnonymous` (optional) — per-op carve-out permitting a `null` `userId`. Currently only `registrations.insert` opts in.
- `redact` (optional) — per-op path-list of fields stripped from the audit payload before logging, used by sensitive sites such as `members.insert` to keep secrets out of the audit trail.

The registry holds plain TypeScript values throughout: no predicate functions, no string-key DSLs, no discriminated-union "kind" fields. The `Record<CrudCollectionName, _>` type forces every member of the canonical collection-name union to have an entry — adding a collection to the union without updating the registry is a compile error.

### LocaleSet

The single deep module (`imports/i18n/`) that owns the translation set as one typed object indexed by typed dotted-key. The runtime entry point is `t<K extends LocaleKey>(key: K, params: ExtractParams<typeof translations[K]['en']>): string`.

Source of truth is `imports/i18n/translations.ts` — a flat `Record<DottedKey, Record<Locale, string>>` with `as const satisfies TranslationSet`. The 138 call sites pass dotted strings (`t('common.create')`) unchanged from before; depth comes from what is now structurally impossible:

- **Missing key per locale** — the `{ en: string; de: string; fr: string }` row shape makes a missing translation a compile error at the source, not a runtime fallback to the literal key string.
- **Typo on the call site** — `LocaleKey = keyof typeof translations` makes `t('comon.create')` a compile error.
- **Missing/extra interpolation params** — template-literal-type extraction over `translations[K]['en']` derives the required params per call.
- **Cross-locale drift in nesting structure** — there is no nesting; the structure is the type.

The previous design (three hand-synchronized `locales/{en,de,fr}.json` files + a `getTranslation` walker that returned the key string on miss) had no way to express any of these invariants. The deepening removes the JSON files entirely; the locale set lives once, in TypeScript.

### DrawerStack

The single deep module (`imports/ui/drawer-stack/`) that owns the side-panel UI for nested entity editing. Replaces the two parallel `DrawerContext` / `SubdrawerContext` providers and the hand-rolled depth heuristic (`useSubdrawer` boolean prop, `const usedDrawer = !drawer.drawerOpen ? drawer : subdrawer`) that previously sprawled across `Section`, `CollectionSelect`, and every nested form (`RanksForm`, `SquadsForm`, `SpecializationForm`, …).

Internally the module holds an ordered array of **frames**. Each `InternalFrame` carries `{ id, title, Component, model, extra, confirmCloseRef, resolveFn, settled }`; the slice handed to a form through `FrameContext` is `{ model, resolve, cancel, confirmCloseRef }`. The renderer reflects the array as a recursively nested chain of antd `<Drawer>` elements — depth is unbounded, no caller is depth-aware.

The seam is three hooks:

- **`useDrawerStack()`** — used by openers (`Section`, `CollectionSelect`, `Palette`). Exposes `push<R, M>(options): Promise<R | undefined>`, where `options` is `{ title, Component, model, extra? }`. Every push returns a promise that resolves with the value the form passes to its frame's `resolve`, or `undefined` if the user cancels. This is the new leverage: a `CollectionSelect` inside a `SquadsForm` can `await editor.push(...)` to create a new `Rank` inline and receive the inserted doc back, auto-selecting it — eliminating the "create, close, re-find" dance.
- **`useDrawerFrame<R, M>()`** — used by forms. Returns `{ model, resolve, cancel }`, resolving the topologically-nearest frame, so a form has no idea (and no need to know) what depth it's rendered at. Replaces both `useContext(useSubdrawer ? SubdrawerContext : DrawerContext)` and the `setOpen` / `useSubdrawer` props on every form.
- **`useConfirmClose(predicate)`** — used by forms with unsaved-state guards. Writes the predicate into the nearest frame's `confirmCloseRef.current` on every render; the predicate returns `boolean | Promise<boolean>`.

Close semantics: when the user dismisses the top frame (antd `onClose` from X-click or mask-click), the stack invokes the predicate stored in that frame's `confirmCloseRef` first; it may return `false` (or a `Promise<boolean>`) to abort the close. User-initiated close is the only path that runs the predicate — code-initiated `resolve(value)` / `cancel()` from inside a form is authoritative and skips the prompt. Programmatic close of a non-top frame cascades down: any frames stacked above also resolve with `undefined`, matching the modal-dialog convention.

The depth pattern that previously required a `useSubdrawer: boolean` prop drilled through every nested form, plus an `if (drawer.drawerOpen) use subdrawer else use drawer` branch at each open site, is now structurally impossible — there is no second context to choose between, and frames don't expose their depth on the seam.

### MethodCall

The single deep module (`imports/ui/hooks/useMethod.ts`) that owns the client side of invoking a Meteor method. Meteor's untyped `Meteor.callAsync` is wrapped exactly once so that error narrowing, failure-notification policy, success feedback, and in-flight `loading` state live behind one hook instead of being re-derived at every call site. It is the client-side counterpart to [[MutationWithAudit]]: that owns the server mutation lifecycle, this owns the client call.

The seam is one hook:

- **`useMethod<T>(name, opts?)`** — binds a method name (computed names like `isUpdate ? 'squads.update' : 'squads.insert'` are fine) and returns `{ call, loading, error, data }`.
  - `call(...args)` invokes the method and resolves to a discriminated `Result<T> = { ok: true; data: T } | { ok: false; error: Meteor.Error }`. It does **not** throw for a server-side `Meteor.Error`; callers branch on `res.ok`. The discriminated shape (not a bare `T | undefined`) keeps void methods unambiguous — a `remove` that resolves to nothing is still `{ ok: true }`, distinct from a handled failure.
  - On failure the hook narrows `unknown → Meteor.Error` once and fires `notification.error` (the persistent-panel channel) — unless `opts.notify === false`, the opt-out used by the field-availability validators (`members.validateName`, `registrations.validateId`, …) that fold a failure into a form-field state rather than a popup.
  - On success it fires `message.success` (the toast channel) when `opts.success` is set — a string, or a `(data) => string` for create-vs-update message divergence. Reads omit `success`.
  - `loading` / `error` / `data` are reactive (for button-disable and inline rendering); the same values are also carried by the `Result` that `call` returns, for use inside handlers.

Channel convention is baked in: success → `message` (toast), failure → `notification` (panel). The hook calls `App.useApp()` internally, satisfying the provider-order rule (message/notification must resolve inside a descendant of `<App>`) — which is *why* the seam is a hook and not a free function.

Internally the seam has a private core: `runMethodCall(invoke, policy, feedback)` (`imports/ui/hooks/runMethodCall.ts`) holds all the policy — narrowing, notify/success decisions, the discriminated outcome — with no React and no antd. `useMethod` is the thin adapter that wires React `loading`/`error`/`data` state and `App.useApp()` feedback onto it. That internal seam is what makes the policy testable in the server test context (`tests/server/runMethodCall.test.ts`, DOM-free), with the hook's React wiring covered by a browser-only smoke test (`tests/client/hooks/useMethod.test.tsx`) — the same split the [[DrawerStack]] uses (pure `drawerStackStore` + browser hook test).

What the previous design could not express, now structural: the `error as Meteor.Error` cast (forced into every `catch` by `strict`) lives in one place; changing notification policy, adding telemetry, or adding retry is one edit instead of touching ~69 call sites; and the accidental error-extraction drift (`error.reason || error.message` at one site, a missing `as string` cast at two others) cannot recur because there is exactly one extraction — `{ message: error.error, description: error.reason || error.message }`, preferring the clean reason and dropping the `[<code>]` suffix Meteor appends to `.message`. The bespoke success *strings* stay at the call sites where they belong, so the hook is not a pass-through. The per-form create-vs-update branching of *name* and *message* is deliberately **not** absorbed here — that is the job of the [[EntityForm]] lifecycle (`useEntityForm`) built on top of this seam.

### EntityForm

The deep module (`imports/ui/hooks/useEntityForm.ts`) that owns the create-vs-update submit lifecycle of a drawer entity form. Built on top of [[MethodCall]]: where `useMethod` owns one client method call, `useEntityForm` owns the whole "save this entity" flow — choosing insert vs update, computing the success message, shaping the call arguments, and resolving the drawer frame on success.

The seam is one hook:

- **`useEntityForm<V, M>({ collection, created, updated, toPayload? })`** — self-sources the drawer frame (`useDrawerFrame`) and returns `{ onFinish, loading, model, cancel }`. `V` is the antd form-values shape; `M` is the model type read from the frame.
  - `collection` is a `CrudCollectionName`; the method name is derived mechanically as `${collection}.update` / `${collection}.insert`.
  - `created` / `updated` are `ParameterlessLocaleKey`s (a success toast carries no interpolation params); the hook picks between them, so the call site no longer writes the `model?._id ? t(a) : t(b)` ternary.
  - `toPayload(values: V) => unknown` (optional, defaults to identity) is the one genuinely form-specific step — which fields, color extraction, date parsing — and closes over component state (`imageSrc`, …). The payload is sent untyped through `useMethod`/`callAsync`, so it is intentionally not constrained to a payload generic (TS cannot infer it alongside the explicit `<V, M>`).
  - `onFinish(values)` is the ready-to-use antd `<Form onFinish>` handler: it shapes args as `[...(isUpdate ? [model._id] : []), toPayload(values)]`, calls the method through `useMethod`, and on success resolves the frame with `model?._id ?? data`. On failure it does nothing (the seam already notified).
  - `model` / `cancel` are re-exposed from the self-sourced frame, so the form needs no separate `useDrawerFrame` call (`initialValues={model}`, `<FormFooter onCancel={cancel} loading={loading} />`).

The create-vs-update axis is a single derived predicate: `isUpdate = !!Meteor.user() && !!model?._id`, used for **both** the method name and the success message. The `Meteor.user() &&` clause means an anonymous caller always inserts (load-bearing for the anonymous RegistrationForm; a no-op for forms only reachable while authenticated). This unifies a latent inconsistency in the hand-rolled forms, where the name used the user-guarded predicate but the message used only `model?._id`.

Escape hatches are **composition, not configuration**. The interface stays tiny; forms that deviate compose around it rather than feeding it flags:

- a pre-submit guard (Member/Registration `disableSubmit`) wraps `onFinish`;
- an extra mutation (Event's in-form delete, Task's add-comment) is a separate `useMethod` alongside;
- a form that is not create-vs-update at all (QuestionnaireResponseForm — a single `questionnaireResponses.submit` resolving `true`) keeps using `useMethod` directly and does not adopt the hook.

There is deliberately no `canSubmit` / `resolveWith` / `extraActions` / `method`-override config — that path is the DSL drift the [[Rule of three]] guards against.

Internally the seam splits like [[MethodCall]] and [[DrawerStack]]: a pure DOM-free core (the `isUpdate` rule, method-name derivation, arg shaping, resolve-value computation) tested under server-mode `npm test`, with the hook as the thin adapter wiring `useDrawerFrame` + `useMethod`, covered by a browser-only smoke test.

What becomes structurally impossible: the ~10× duplicated insert/update plumbing (name ternary, `[...(id?[id]:[]), payload]` arg shaping, `if (!res.ok) return; resolve(id ?? data)`) collapses to one implementation; the name/message create-vs-update inconsistency cannot recur; and a new entity form declares only its `collection`, its two message keys, and its `toPayload`.

## Doctrines

### Rule of three

Variations in **3+ sites** go in the registry as data; variations in **1–2 sites** stay as code in custom method bodies that opt into the wrapper. This is a falsifiable test for future registry vocabulary changes, and the discipline that keeps the registry inspectable as plain values rather than drifting into a configuration DSL.

When you find yourself wanting to express a new kind of variation in the registry (a new field, a new gate kind, a new shape modifier), the question is empirical: *is this pattern already present in three or more sites?* If yes, promote it to the registry. If no, leave it as code in the body of the one or two methods that need it; revisit when a third site appears. This applies in both directions: a registry field that's used by only one or two sites is a candidate for demotion back to code in those bodies.
