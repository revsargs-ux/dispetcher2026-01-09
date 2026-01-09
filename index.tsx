
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { simulationService } from './services/simulationService';

// Запуск фоновой симуляции для наполнения данными
simulationService.start();

/**
 * Регистрация Service Worker для Push и GPS.
 * Используем относительный путь './sw.js' вместо абсолютного '/sw.js',
 * чтобы избежать ошибок несовпадения origin в песочницах (sandbox) и прокси-средах.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // В средах типа AI Studio / StackBlitz относительный путь позволяет SW 
    // зарегистрироваться в правильной области видимости (scope) текущего домена.
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      console.log('Д.ПРО: Service Worker зарегистрирован. Scope:', reg.scope);
    }).catch(err => {
      // Игнорируем ошибку в средах, где SW принципиально запрещен (например, в некоторых iframe)
      console.warn('Д.ПРО: Регистрация SW не удалась (это нормально для некоторых браузеров):', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
