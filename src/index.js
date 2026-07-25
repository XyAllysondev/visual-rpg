import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css'; // Tailwind + tokens shadcn (ADR-0007). preflight OFF — não reseta o app.
import App from './App';
import { LocaleProvider } from './i18n/useLocale';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <LocaleProvider>
    <App />
  </LocaleProvider>
);
