import './HomePage.css';
import { useState } from 'react';

const BACKEND_URL = 'http://localhost:8000';

const BASH_COMMAND = `curl -sL https://raw.githubusercontent.com/TechShreyash/RedPen/main/scan.sh | bash`;

const POWERSHELL_COMMAND = `irm https://raw.githubusercontent.com/TechShreyash/RedPen/main/scan.ps1 | iex`;

const MANUAL_BASH = `# Or run manually:
zip -r /tmp/redpen_scan.zip . -x "node_modules/*" ".git/*" "__pycache__/*" "*.pyc" ".env" \\
  && curl -X POST ${BACKEND_URL}/api/scan -F "file=@/tmp/redpen_scan.zip" \\
  && rm /tmp/redpen_scan.zip`;

const MANUAL_PS = `# Or run manually (PowerShell):
Compress-Archive -Path . -DestinationPath $env:TEMP\\redpen_scan.zip -Force
curl.exe -X POST ${BACKEND_URL}/api/scan -F "file=@$env:TEMP\\redpen_scan.zip"
Remove-Item $env:TEMP\\redpen_scan.zip`;

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('bash');
  const [copied, setCopied] = useState(false);

  const command = activeTab === 'bash' ? BASH_COMMAND : POWERSHELL_COMMAND;

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="home-page" id="home-page">
      {/* Hero Section */}
      <section className="hero" id="hero-section">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Open Source Security Scanner
          </div>
          <h1 className="hero-title">
            Find vulnerabilities in your<br />
            <span className="hero-title-accent">vibe-coded</span> apps
          </h1>
          <p className="hero-subtitle">
            RedPen scans your codebase for SQL injection, XSS, hardcoded secrets, insecure CORS, 
            and 1000+ security rules — powered by Semgrep.
          </p>
        </div>
      </section>

      {/* Command Section */}
      <section className="command-section" id="command-section">
        <h2 className="section-title">
          <span className="section-title-number">01</span>
          Run in your project directory
        </h2>

        <div className="command-card glass-card">
          {/* Tab Switcher */}
          <div className="command-tabs">
            <button
              className={`command-tab ${activeTab === 'bash' ? 'active' : ''}`}
              onClick={() => setActiveTab('bash')}
              id="tab-bash"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              Bash / macOS / Linux
            </button>
            <button
              className={`command-tab ${activeTab === 'powershell' ? 'active' : ''}`}
              onClick={() => setActiveTab('powershell')}
              id="tab-powershell"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              PowerShell / Windows
            </button>
          </div>

          {/* Command Display */}
          <div className="command-display">
            <div className="command-prefix">$</div>
            <code className="command-text">{command}</code>
            <button
              className="command-copy-btn"
              onClick={handleCopy}
              title="Copy command"
              id="copy-command-btn"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section" id="how-it-works">
        <h2 className="section-title">
          <span className="section-title-number">02</span>
          How it works
        </h2>

        <div className="steps-grid">
          <div className="step-card glass-card animate-fade-in-up stagger-1">
            <div className="step-number">1</div>
            <div className="step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </div>
            <h3>Run the command</h3>
            <p>Execute the curl script in your project directory. It zips your code and uploads it securely.</p>
          </div>

          <div className="step-card glass-card animate-fade-in-up stagger-2">
            <div className="step-number">2</div>
            <div className="step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <h3>Semgrep analyzes</h3>
            <p>The backend runs 1000+ security rules covering OWASP Top 10, CWE, and framework-specific checks.</p>
          </div>

          <div className="step-card glass-card animate-fade-in-up stagger-3">
            <div className="step-number">3</div>
            <div className="step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>View your results</h3>
            <p>Get a unique URL printed in your CLI. Open it to see each vulnerability with highlighted code snippets.</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section" id="features-section">
        <h2 className="section-title">
          <span className="section-title-number">03</span>
          What RedPen detects
        </h2>

        <div className="features-grid">
          {[
            { icon: '💉', title: 'SQL Injection', desc: 'Detects unsanitized database queries' },
            { icon: '🔓', title: 'Hardcoded Secrets', desc: 'API keys, passwords, JWT secrets in code' },
            { icon: '🌐', title: 'Insecure CORS', desc: 'Overly permissive cross-origin policies' },
            { icon: '⚡', title: 'XSS Vulnerabilities', desc: 'Cross-site scripting attack vectors' },
            { icon: '🔑', title: 'Auth Bypass', desc: 'Missing or broken authentication checks' },
            { icon: '📦', title: 'Dependency Issues', desc: 'Known CVEs in your dependencies' },
          ].map((feature, i) => (
            <div key={feature.title} className={`feature-tag glass-card animate-fade-in-up stagger-${i % 6 + 1}`}>
              <span className="feature-icon">{feature.icon}</span>
              <div>
                <strong>{feature.title}</strong>
                <span className="feature-desc">{feature.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
