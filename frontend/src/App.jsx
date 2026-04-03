import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScanResultsPage from './pages/ScanResultsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app" id="app-root">
        {/* Header */}
        <header className="app-header" id="app-header">
          <div className="app-header-inner">
            <a href="/" className="app-logo">
              <div className="app-logo-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e63946" />
                      <stop offset="100%" stopColor="#ff6b6b" />
                    </linearGradient>
                  </defs>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4" stroke="url(#logoGrad)" strokeWidth="2"/>
                </svg>
              </div>
              <div>
                <h1 className="app-title">RedPen</h1>
                <p className="app-subtitle">Security Vulnerability Scanner</p>
              </div>
            </a>
            <div className="app-header-right">
              <a
                href="https://github.com/TechShreyash/RedPen"
                target="_blank"
                rel="noopener noreferrer"
                className="app-github-link"
                title="View on GitHub"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <span className="app-version">v1.0.0</span>
            </div>
          </div>
        </header>

        {/* Routes */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scan/:id" element={<ScanResultsPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="app-footer" id="app-footer">
          <p>RedPen Security Scanner — Powered by Semgrep</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
