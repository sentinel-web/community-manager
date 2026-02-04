import React from 'react';
import App from './app/App';
import { LanguageProvider } from '../i18n/LanguageContext';

export default function ReactTarget() {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}
