import React from 'react';
import { createRoot } from 'react-dom/client';
import { BasketApp } from './basket';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BasketApp />
  </React.StrictMode>
);

