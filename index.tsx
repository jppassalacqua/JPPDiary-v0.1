
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { seedDatabase } from './services/dataSeeder';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  
  // Initialize test data (if missing) before rendering
  seedDatabase().catch(console.error).finally(() => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
}
