import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AOS from 'aos'; 
import 'aos/dist/aos.css'; 
import './pages/styles/main.scss'; // Your main styles (fixed widths & overflow)
import { CartProvider } from './pages/context/CartContext';
import { LocaleProvider } from './pages/context/LocaleContext';
import { HelmetProvider } from 'react-helmet-async';
import { startVersionWatcher } from './utils/versionWatcher';

// Initialize AOS (Animate On Scroll) library (deferred)
const initAOS = () => {
  try {
    AOS.init({
      duration: 700,
      easing: 'ease-in-out',
      once: true,
      offset: 100,
      disable: () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  } catch {}
};
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(initAOS, { timeout: 2000 });
} else {
  setTimeout(initAOS, 800);
}

// Ensure no stale service worker controls the app (production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {}
  });
}

// Start version watcher to auto-reload on new deployment
startVersionWatcher();

// Create React root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the app
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <LocaleProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </LocaleProvider>
    </HelmetProvider>
  </React.StrictMode>
);
