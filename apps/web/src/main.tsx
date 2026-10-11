// First, so that a component's own stylesheet comes after it and can override it.
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

// A tab left open across a deploy asks for files the new release no longer has. Loading the page
// again gets the release that does; once only, so a file that is really missing cannot loop.
const RELOADED_FOR_RELEASE = 'bgp.reloaded-for-release';
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem(RELOADED_FOR_RELEASE)) return;
    sessionStorage.setItem(RELOADED_FOR_RELEASE, '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
