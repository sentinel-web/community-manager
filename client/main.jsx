import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import ReactTarget from '../imports/ui/ReactTarget'

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  if (container) {
  const root = createRoot(container);
  root.render(<ReactTarget />);
  }
});
