# UI Architecture (routing, Section, DrawerStack, hooks, contexts)

The client-side skeleton every feature hangs off: how the provider tree mounts, how pathname-based routing picks a view, how the generic `Section<T>` CRUD page is assembled from a collection + columns factory + drawer form, and the DrawerStack / hooks / contexts that view code composes against.

## Key files

| Path | Role |
|------|------|
| `client/main.tsx` | Client entry — mounts `<ReactTarget />` on `Meteor.startup`. No router library. |
| `imports/ui/ReactTarget.tsx` | Root: wraps `<App>` in `<LanguageProvider>`. |
| `imports/ui/app/App.tsx` | App shell — provider tree, antd `ConfigProvider`/`<App>`, `Layout`, declares `NavigationContext` + `ThemeContext`. |
| `imports/ui/main/Main.tsx` | Routing switch — `navigationValue` → one `lazy()` view, gated by `checkAccess` + `MODULE_PERMISSION_MAP`. |
| `imports/ui/navigation/Navigation.tsx` | Nav menu + `getNavigationValue()` (pathname → key); pushes history on click, listens to `popstate`. |
| `imports/ui/navigation/navigation.hook.tsx` | `useNavigation()` — reads `NavigationContext`. |
| `imports/ui/section/Section.tsx` | Generic `Section<T>` CRUD page — subscribe/find, permissions, table, create/edit/delete drawers, bulk actions. |
| `imports/ui/section/SectionCard.tsx` | Card wrapper (title + loading skeleton). |
| `imports/ui/section/types.ts` | `ColumnsFactory<T>`, `SectionPermissions`, `GroupAction`. |
| `imports/ui/drawer-stack/` | DrawerStack module — nested-drawer editing (`useDrawerStack`/`push`, `useDrawerFrame`, `useConfirmClose`, `DrawerFooter`). |
| `imports/ui/hooks/useMethod.ts` + `runMethodCall.ts` | MethodCall seam — typed adapter over `Meteor.callAsync`. |
| `imports/ui/hooks/useEntityForm.ts` + `entityFormSubmit.ts` | EntityForm seam — create-vs-update drawer-form submit lifecycle. |
| `imports/ui/hooks/useViewportSize.ts` | Debounced reactive `{ width, height }` for width-dependent UI. |
| `imports/ui/components/FormFooter.tsx` | Submit/cancel buttons portaled into the drawer footer slot. |
| `imports/ui/components/CollectionSelect.tsx` | Multi/single select with inline create/edit via DrawerStack, auto-selects the new doc. |
| `imports/config.ts` | UI constants — `BREAKPOINTS`, `LAYOUT`, `getDrawerWidth`/`getModalWidth`/`isDeviceUnsupported`. |
| `imports/i18n/LanguageContext.tsx` | `LanguageProvider` + `useTranslation()`/`useLanguage()`. |
| `imports/ui/theme/theme.hook.tsx`, `imports/ui/palette/PaletteContext.tsx`, `imports/ui/tour/TourContext.tsx` | Theme / command-palette / guided-tour contexts. |

## How it works

### Provider tree

`client/main.tsx` mounts `<ReactTarget />` into `#react-target`. The nesting (outer → inner) is fixed and order-sensitive:

```
LanguageProvider                 (ReactTarget.tsx)
└─ ThemeContext.Provider         (App.tsx)
   └─ NavigationContext.Provider
      └─ TourProvider
         └─ PaletteProvider
            └─ ConfigProvider    (antd theme tokens, dark/light algorithm)
               └─ AntdApp        (<App>, message maxCount 1, notification maxCount 3)
                  └─ DrawerStackProvider
                     └─ Layout (Header / Main / Footer) + DemoTour (dev) + Palette
```

Two contexts are *declared* in `App.tsx` (`NavigationContext`, `ThemeContext` at `App.tsx:18-19`) and consumed via thin hooks in sibling folders (`navigation.hook.tsx`, `theme.hook.tsx`). `App` holds `theme` and `navigationValue` as local state and seeds them from `getPreferedTheme()` / `getNavigationValue()`.

Antd contextual feedback (`message`, `notification`, `modal`) is only available to descendants of `<AntdApp>` via `App.useApp()`. This is *why* `useMethod`/`Section` resolve feedback through `App.useApp()` and never the static antd singletons (which render outside the provider and won't show inside a drawer/modal).

### Routing (pathname-based, no router library)

There is no React Router. Routing is a string `navigationValue`:

| Step | Mechanism |
|------|-----------|
| URL → key | `getNavigationValue()` (`Navigation.tsx:63`) maps `window.location.pathname` to a key (`/` and unknown → `'dashboard'`). |
| State | `App` holds `navigationValue` in `useState(getNavigationValue)`; exposed via `NavigationContext`. |
| Navigate | `Navigation` menu `onClick` → `setNavigationValue(key)` + `window.history.pushState(…/key)`. |
| Back/forward | `Navigation` listens to `popstate` and re-syncs `navigationValue` from the pathname. |
| Render | `Main.tsx` is a flat list of `navigationValue === 'x' && <X />` guards. |

`Main` renders each view through `lazy()` + `<Suspense>` (code-splitting), gating each on `hasAccess`. Access is computed by `checkAccess(role, navigationValue)` (`Main.tsx:18`): admin (`role.roles === true`) passes; a boolean module permission passes on `true`; a CRUD-module permission passes on `read === true`. `MODULE_PERMISSION_MAP` (`Main.tsx:13`) redirects view keys whose permission lives under a different module — `backup → settings`, `myQuestionnaires → questionnaires`. The same role doc is read three times independently (here, in `Navigation`, in each `Section`) via `useSubscribe('roles', { _id: roleId }, { limit: 1 })`.

Device gate: `isDeviceUnsupported(width)` (below `BREAKPOINTS.MIN_SUPPORTED_WIDTH` = 360px) short-circuits to a 406 `Result` before any view renders.

### The Section pattern (Section + columnsFactory + drawer form)

`Section<T>` (`Section.tsx:83`) is the generic CRUD page most list views render. A feature wires it up declaratively:

```tsx
<Section<Squad>
  title={t('navigation.squads')}
  collectionName="squads"
  Collection={SquadsCollection}
  FormComponent={SquadsForm}
  columnsFactory={getSquadColumns}
/>
```

What `Section` does internally:

| Concern | Implementation |
|---------|----------------|
| Reactive data | `useSubscribe(collectionName, filter, options)` + `useFind(() => Collection.find(filter, options))`. |
| Search | `TableHeader` input → `filterFactory(input)` (default `{ name: { $regex, $options: 'i' } }`). |
| Pagination | `options.limit` starts at 20, `handleLoadMore` adds 20; `TableFooter` "load more" disabled when fewer rows than the limit. |
| Permissions | reads the user's role doc, derives `{ canCreate, canUpdate, canDelete }` via `getModulePermissions(role, permissionModule ?? collectionName)`. |
| Columns | `columns = columnsFactory(handleEdit, handleDelete, permissions, t)` — the factory builds the antd `ColumnsType<T>` and decides which action buttons to show. |
| Create | `handleCreate` → `drawerStack.push({ Component: FormComponent, model: {} })`. |
| Edit | `handleEdit(e, record)` → `drawerStack.push({ Component: FormComponent, model: record })`. |
| Delete | `handleDelete` pre-flights `integrity.preview`, shows `DeleteImpactPreview` in a `modal.confirm`, then `${collectionName}.remove`. |
| Bulk | row selection (shown when `canDelete` or `groupActions` exist) → `GroupActionsBar`; bulk delete pre-flights `integrity.previewBulk` then `${collectionName}.bulkRemove`. |
| Deep-link create | a `?action=create` query param auto-opens the create drawer once, then strips the param via `history.replaceState` (`Section.tsx:151`). This is how `Palette` opens a create form — it navigates to `/key?action=create` rather than calling `push` directly. |

`ColumnsFactory<T>` (`section/types.ts:15`) is the per-feature seam:

```ts
const getSquadColumns: ColumnsFactory<Squad> =
  (handleEdit, handleDelete, permissions, t) => [ /* antd columns */ ];
```

A view that is not a table passes `customView` (a render component receiving `{ handleEdit, handleDelete, datasource, setFilter, permissions }`) instead of using the built-in `Table` — e.g. calendar, kanban, orbat.

`getModulePermissions` (`Section.tsx:23`) and `checkAccess` (`Main.tsx`) and `hasAccess` (`Navigation.tsx:46`) are three near-identical role→permission readers — Section needs the full CRUD triple, Main/Navigation only the read bit. Pass `permissionModule` when the collection name differs from its permission module (e.g. a sub-collection page), or the wrong module is resolved.

### DrawerStack — nested entity editing

`imports/ui/drawer-stack/` is the deep module owning the side-panel UI (see [[DrawerStack]] in CONTEXT.md). It holds an ordered array of **frames**; the renderer reflects that array as a recursively nested chain of antd `<Drawer>`s (`FrameRenderer` in `DrawerStackProvider.tsx`). Depth is unbounded and no caller is depth-aware. State lives in a framework-free store (`drawerStackStore.ts`) bridged to React via `useSyncExternalStore`.

The seam is three hooks (exported from `drawer-stack/index.ts`):

| Hook | Used by | Returns / does |
|------|---------|----------------|
| `useDrawerStack()` | **openers** (`Section`, `CollectionSelect`) | `push<R, M>({ title, Component, model, extra? }): Promise<R \| undefined>`. The promise resolves with whatever the form passes to `resolve`, or `undefined` if cancelled. |
| `useDrawerFrame<R, M>()` | **forms** | `{ model, resolve, cancel, footerContainer }` — resolves the nearest frame; the form never knows its depth. |
| `useConfirmClose(predicate)` | forms with unsaved-state guards | writes `predicate` (returning `boolean \| Promise<boolean>`) into the nearest frame's `confirmCloseRef` on every render. |

Frame data shapes:

| `InternalFrame` (store) | `FrameContextValue` (slice handed to a form) |
|-------------------------|----------------------------------------------|
| `id, title, Component, model, extra, confirmCloseRef, resolveFn, settled` | `model, resolve, cancel, confirmCloseRef, footerContainer` |

Resolution / close semantics (`drawerStackStore.ts`):

- `push` appends a frame and returns a promise. `resolveFrame(id, value)` / `cancelFrame(id)` (cancel = resolve with `undefined`) settle it and slice the array back to that index.
- **Cascade-down**: closing a non-top frame settles every frame *above* it with `undefined` first (top-to-bottom), then the target with its value (`dropFromIndex`).
- `settle` is idempotent (`settled` flag) so a frame's promise resolves at most once.
- **User-initiated close** (X-click / mask-click → antd `onClose` → `tryClose`) consults the *top* frame's `confirmCloseRef` predicate; a `false` return aborts. Code-initiated `resolve`/`cancel` from inside a form is authoritative and **skips** the predicate. Only the top drawer is `maskClosable` (`isTop`).

The leverage: a `CollectionSelect` inside a `SquadsForm` can `await push(...)` to create a `Rank` inline and receive the inserted id back, auto-selecting it — no "create, close, re-find" dance.

### Drawer footer portal

`<Drawer>` always renders a footer slot DOM node (`frame-footer-slot`); the node is exposed on the frame as `footerContainer`. `DrawerFooter` (`drawer-stack/DrawerFooter.tsx`) `createPortal`s its children into that node so action buttons pin to the drawer bottom while the body scrolls. Because a portal preserves the React tree, the buttons stay React descendants of the surrounding `<Form>` (antd `disabled={loading}` context still reaches them) — but the DOM lives *outside* the `<form>` element, so a submit button cannot use `htmlType="submit"`. `FormFooter` instead walks up from an in-form anchor and calls `form.requestSubmit()`; `DrawerFooter` emits a hidden in-form submit button to preserve native Enter-to-submit.

### Form submit hooks (MethodCall + EntityForm)

Two layered seams own client method calls and the form submit lifecycle (full doctrine: [[MethodCall]], [[EntityForm]] in CONTEXT.md):

- **`useMethod<T>(name, opts?)`** (`hooks/useMethod.ts`) — adapter over `Meteor.callAsync`. Returns `{ call, loading, error, data }`. `call(...args)` resolves to a discriminated `MethodResult<T> = { ok: true; data: T } | { ok: false; error: Meteor.Error }` and **never throws** for a server `Meteor.Error`. On success it fires `message.success` when `opts.success` is set (a string or `(data) => string`); on failure it fires `notification.error` unless `opts.notify === false`. The pure policy core is `runMethodCall.ts` (DOM-free, testable).
- **`useEntityForm<V, M>({ collection, created, updated, toPayload? })`** (`hooks/useEntityForm.ts`) — built on `useMethod` + `useDrawerFrame`. Returns `{ onFinish, loading, model, cancel }` ready for `<Form initialValues={model} onFinish={onFinish}>`. It derives create-vs-update from `entityIsUpdate(!!Meteor.user(), model?._id)`, picks the method name (`<collection>.insert`/`.update`) and message, shapes args (`[id, payload]` vs `[payload]`), and on success resolves the frame with `model?._id ?? data`. The DOM-free logic is `entityFormSubmit.ts`. `toPayload` is the one form-specific step (field selection, color/date extraction). Forms that aren't create-vs-update (e.g. `QuestionnaireResponseForm`) use `useMethod` directly.

A typical drawer form:

```tsx
function SquadsForm() {
  const { onFinish, loading, model, cancel } = useEntityForm<SquadFormValues, Squad>({
    collection: 'squads', created: 'messages.created', updated: 'messages.updated',
    toPayload: v => ({ name: v.name, color: v.color }),
  });
  // useConfirmClose(() => isDirty); // optional unsaved-guard
  return (
    <Form layout="vertical" initialValues={model} onFinish={onFinish}>
      {/* fields */}
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
```

### Contexts

| Context | Provider | Hook(s) | Holds |
|---------|----------|---------|-------|
| `NavigationContext` | `App.tsx` | `useNavigation()` | `navigationValue` + setter (the route). |
| `ThemeContext` | `App.tsx` | `useTheme()` | `'dark' \| 'light'` + setter; seeded from OS preference, follows `prefers-color-scheme` changes. |
| `LanguageContext` | `LanguageProvider` (`i18n`) | `useLanguage()` / `useTranslation()` | `language`, `setLanguage`, `t`; persisted to `localStorage` + browser-autodetected. |
| `PaletteContext` | `PaletteProvider` | `useContext(PaletteContext)` | command-palette `open`/`toggle`; binds the global ⌘K / Ctrl-K keydown. |
| `TourContext` | `TourProvider` | `useTourRef()`, `useTourAction()` | first-run tour: ref/action registries (mutable refs) + `open`/`currentStep`. |

`DrawerStackContext` / `FrameContext` (`DrawerStackProvider.tsx`) back the DrawerStack hooks above. `useDrawerStack`/`useDrawerFrame`/`useConfirmClose` throw if used outside their provider/frame.

### UI constants (`imports/config.ts`)

| Symbol | Value / behavior |
|--------|------------------|
| `BREAKPOINTS.MIN_SUPPORTED_WIDTH` | 360 — below this, the device-unsupported gate fires. |
| `BREAKPOINTS.MOBILE` | 768 — full-width drawers/modals below this. |
| `LAYOUT.DRAWER_WIDTH_RATIO` | 0.33 of viewport width on desktop. |
| `LAYOUT.MODAL_WIDTH_RATIO` | 0.75 of viewport width on desktop. |
| `getDrawerWidth` / `getModalWidth` / `isDeviceUnsupported` | width helpers; fed by `useViewportSize()`. |

`useViewportSize(debounceMs = 150)` is the reactive width source (debounced `resize` + `orientationchange`), used by the device gate, drawer width, and modal width so they recompute on resize/rotation instead of freezing at first render.

## Gotchas

- **`useFind` needs a live `useSubscribe`.** Without the subscription the cursor stays empty; a missing/stale dep array on `useFind`/`useCallback`/`useMemo` is the usual "data won't load / won't update" bug (CLAUDE.md → Common Gotchas).
- **`permissionModule` prop on `Section`.** When the collection name differs from its permission module, pass `permissionModule` or `getModulePermissions` resolves the wrong module. The view-level analogue is `MODULE_PERMISSION_MAP` in `Main.tsx`.
- **Use `App.useApp()` for feedback inside drawers.** `useMethod`/`Section` pull `message`/`notification`/`modal` from the contextual `App.useApp()`; the static antd singletons won't render inside drawer/modal context. (CLAUDE.md → Forms.)
- **Submit buttons in a drawer can't be `htmlType="submit"`.** The footer is portaled outside the `<form>` element. Use `form.requestSubmit()` / `form.submit()` from an `onClick`; `FormFooter` and `DrawerFooter` already handle this (incl. a hidden in-form button for Enter-to-submit).
- **Forms never know their depth.** Use `useDrawerFrame` (`resolve`/`cancel`), never any depth-aware branching — the old `DrawerContext`/`SubdrawerContext`/`useSubdrawer` pattern is gone. Don't reach for `setOpen`.
- **`useConfirmClose` predicate only runs on user-initiated close.** `resolve`/`cancel` from inside a form skip it; closing a non-top frame cascades resolutions downward with `undefined`.
- **No router.** Links must `history.pushState` + `setNavigationValue`; reading `window.location` alone won't re-render. Reachable views must be wired into both `getNavigationValue()` and the `Main.tsx` switch.
- **`Palette` opens create forms via the URL, not `push`.** It navigates to `/key?action=create`; the target `Section`'s effect picks up the param and opens the drawer once. A view without a `FormComponent` (or without `canCreate`) silently ignores it.
- **Three independent role reads.** `Main`, `Navigation`, and each `Section` each `useSubscribe('roles', …)` and recompute permissions; there is no shared permission context. Role changes can lag up to the server-side cache TTL (~1 min).
- **`Switch`/`Checkbox` Form.Items need `valuePropName="checked"`; handle both create (`model = {}`, no `_id`) and update in `toPayload`/`handleFinish`.** (CLAUDE.md → Forms.)

## See also

- `docs/system/request-lifecycle.md` — the end-to-end write/read path these forms and hooks feed into.
- `docs/system/permissions-rbac.md` — how `role`/`CrudPermission` is shaped and checked server-side (mirrored client-side by `checkAccess`/`getModulePermissions`/`hasAccess`).
- `docs/system/server-apis.md`, `docs/system/data-model.md`, `docs/system/referential-integrity.md` — server methods, collections, and the `integrity.preview` delete pre-flight `Section` calls.
- `CONTEXT.md` → **DrawerStack**, **MethodCall**, **EntityForm** (the deep-module doctrines for the seams above), **LocaleSet** (`useTranslation`), **Rule of three** (why escape hatches are composition, not config).
- `CLAUDE.md` → "State Management", "Drawer Pattern", "React Components", "Forms", "Meteor Data Hooks", "Common Gotchas".
- `docs/views-and-forms.md` — the index of every navigable view, drawer form, and embedded widget built on this skeleton.
