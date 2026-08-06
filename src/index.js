import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css'; // Tailwind + tokens shadcn (ADR-0007). preflight OFF — não reseta o app.
import App from './App';
import { LocaleProvider } from './i18n/useLocale';
/* Modo demo (`?demo=1`, só em dev — ver src/demo/demoMode.js). A semente roda
   ANTES do React montar porque o `useCharacter` lê o localStorage já no
   primeiro render. Fora do modo demo, `prepararDemo()` não faz nada. */
import { prepararDemo, DEMO_ON } from './demo/demoMode';
import DemoBadge from './demo/DemoBadge';

prepararDemo();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <LocaleProvider>
    <App />
    {DEMO_ON ? <DemoBadge /> : null}
  </LocaleProvider>
);
