import { Meteor } from 'meteor/meteor';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactTarget from '../imports/ui/ReactTarget';

Meteor.startup(() => {
  const html = document.querySelector('html');
  if (html) {
    html.setAttribute('lang', 'en');
  }
  const container = document.getElementById('react-target');
  if (container) {
    const root = createRoot(container);
    root.render(<ReactTarget />);
  }
});
