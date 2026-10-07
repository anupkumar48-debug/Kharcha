import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { isNative } from './lib/native.js';

createRoot(document.getElementById('root')).render(<App />);

// PWA offline shell (web / laptop only)
if ('serviceWorker' in navigator && !isNative() && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
