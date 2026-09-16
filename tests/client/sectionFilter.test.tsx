import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import React from 'react';

// Regression for #358: Section must re-query when its filterFactory prop
// changes, not only when the search input does. Mounts the real Section, so it
// only runs in the Meteor client test context where a browser supplies a DOM;
// the pure selector building is covered by eventFilter.test.ts.
//
// NOTE: this file does NOT run in CI — `.github/workflows/ci.yml` runs
// `meteor test --once` with no browser driver, so the Meteor client context is
// never started. The CI-visible regression for the same behaviour is the
// Playwright spec "should re-query when the date filter changes without typing
// in search" in e2e/tests/events.spec.ts.
if (Meteor.isClient) {
  const ReactDOMClient = require('react-dom/client') as typeof import('react-dom/client');
  const { act } = require('react-dom/test-utils') as { act: (cb: () => void | Promise<void>) => Promise<void> };
  const { App } = require('antd') as typeof import('antd');
  const { Mongo } = require('meteor/mongo') as typeof import('meteor/mongo');
  const { LanguageProvider } = require('/imports/i18n/LanguageContext') as typeof import('/imports/i18n/LanguageContext');
  const { DrawerStackProvider } = require('/imports/ui/drawer-stack') as typeof import('/imports/ui/drawer-stack');
  const Section = (require('/imports/ui/section/Section') as typeof import('/imports/ui/section/Section')).default;

  interface Doc {
    _id: string;
    name: string;
    kind: string;
  }

  type Selector = import('meteor/mongo').Mongo.Selector<Doc>;

  describe('Section — filterFactory changes re-query (#358)', () => {
    const LocalDocs = new Mongo.Collection<Doc>(null);
    const byKindX = (): Selector => ({ kind: 'x' });
    const byKindY = (): Selector => ({ kind: 'y' });

    before(async () => {
      await LocalDocs.insertAsync({ _id: 'a', name: 'Alpha', kind: 'x' });
      await LocalDocs.insertAsync({ _id: 'b', name: 'Bravo', kind: 'y' });
    });

    it('applies a new filterFactory without any search input', async () => {
      const seen: { ids: string[] } = { ids: [] };
      function CaptureView({ datasource }: { datasource: Doc[] }) {
        seen.ids = datasource.map(doc => doc._id).sort();
        return null;
      }

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOMClient.createRoot(container);
      const render = (filterFactory: (input: string) => Selector) =>
        act(async () => {
          root.render(
            <App>
              <LanguageProvider>
                <DrawerStackProvider>
                  <Section<Doc> Collection={LocalDocs} customView={CaptureView} filterFactory={filterFactory} />
                </DrawerStackProvider>
              </LanguageProvider>
            </App>
          );
        });

      try {
        await render(byKindX);
        assert.deepStrictEqual(seen.ids, ['a']);

        await render(byKindY);
        assert.deepStrictEqual(seen.ids, ['b'], 'Section kept the stale filter after filterFactory changed');
      } finally {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      }
    });
  });
}
