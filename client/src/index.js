//           MM
//         c(..)O
//          (-)

//                                                  Made with ❤️


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}

// This app requires an internet connection to function properly.
// We're using unregister() to ensure the app doesn't cache data that needs to be fresh.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();