import { Meteor } from 'meteor/meteor';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactTarget from '../imports/ui/ReactTarget';

// Dev-only: load react-scan to surface wasted React re-renders in the
// browser. Dynamic import keeps the library out of the production bundle.
// react-scan attaches to React internals via the devtools-global hook the
// moment it loads, so firing this side-effect before createRoot ensures
// the very first renders are instrumented.
if (process.env.NODE_ENV !== 'production') {
  import('react-scan')
    .then(({ scan }) => scan({ enabled: true }))
    .catch(error => {
      console.warn('[react-scan] failed to load — continuing without it', error);
    });
}

Meteor.startup(() => {
  // Language is set dynamically by LanguageProvider based on user preference
  const container = document.getElementById('react-target');
  if (container) {
    const root = createRoot(container);
    root.render(<ReactTarget />);
  }
});
