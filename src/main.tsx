import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LibraryProvider } from './context/LibraryContext';
import { PlayerProvider } from './context/PlayerContext';
import { SettingsProvider } from './context/SettingsContext';
import { SyncManager } from './context/SyncManager';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <LibraryProvider>
          <AuthProvider>
            <SyncManager />
            <PlayerProvider>
              <App />
            </PlayerProvider>
          </AuthProvider>
        </LibraryProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
