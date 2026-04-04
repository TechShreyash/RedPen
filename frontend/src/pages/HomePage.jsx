import { useNavigate } from 'react-router-dom';
import PrismaticBurst from '../components/PrismaticBurst/PrismaticBurst';
import TextType from '../components/TextType/TextType';
import CardSwap, { Card } from '../components/CardSwap/CardSwap';
import BorderGlow from '../components/BorderGlow/BorderGlow';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      {/* Full-screen WebGL background */}
      <div className="background-layer">
        <PrismaticBurst
          animationType="rotate3d"
          intensity={2}
          speed={0.5}
          distort={0}
          paused={false}
          offset={{ x: 0, y: 0 }}
          hoverDampness={0.25}
          rayCount={0}
          mixBlendMode="lighten"
          colors={['#ff007a', '#4d3dff', '#ffffff']}
        />
      </div>

      {/* Content overlay */}
      <div className="content-overlay">

        {/* Navigation */}
        <nav className="navbar" id="main-nav">
          <div className="nav-brand">
            <img src="/logo.png" alt="RedPen" className="nav-logo" />
            <span className="nav-title">RedPen</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#detect" className="nav-link">Detect</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link nav-link--github"
            >
              GitHub
            </a>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero-section" id="hero">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            AI Security Scanner
          </div>
          <h1 className="hero-title">
            <span className="hero-title-static">Red</span>
            <span className="hero-title-accent">Pen</span>
          </h1>
          <div className="hero-typing">
            <TextType
              text={[
                "Crossing out vulnerabilities AI left behind.",
                "Strict, automated code-grading for the AI era.",
                "Block vulnerable code before it reaches production.",
                "Parse your syntax tree in milliseconds."
              ]}
              typingSpeed={60}
              pauseDuration={2000}
              showCursor
              cursorCharacter="_"
              deletingSpeed={35}
              className="hero-text-type"
            />
          </div>
          <p className="hero-subtitle">
            A local gatekeeper that parses your AST in milliseconds to catch the invisible
            security debt that AI models ignore — blocking vulnerable code before it ships.
          </p>
        </section>

        {/* Features Section */}
        <section className="features-section" id="features">
          <div className="features-header">
            <h2 className="section-title">Why RedPen?</h2>
            <p className="section-subtitle">
              Every feature is built to catch what AI assistants miss.
            </p>
          </div>

          <div className="features-layout">
            <div className="features-text">
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <div className="feature-info">
                  <h3>Millisecond Analysis</h3>
                  <p>AST-powered scanning completes before your CI pipeline even starts.</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🛡️</div>
                <div className="feature-info">
                  <h3>OWASP & CWE Mapped</h3>
                  <p>Every finding maps to industry-standard vulnerability databases.</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <div className="feature-info">
                  <h3>100% Local</h3>
                  <p>Your code never leaves your machine. Zero cloud dependencies.</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🤖</div>
                <div className="feature-info">
                  <h3>AI-Aware Rules</h3>
                  <p>Purpose-built to catch the patterns AI code generators produce.</p>
                </div>
              </div>
            </div>

            <div className="features-cards">
              <CardSwap
                cardDistance={60}
                verticalDistance={70}
                delay={3000}
                pauseOnHover={false}
                width={420}
                height={280}
              >
                <Card>
                  <div className="swap-card-content">
                    <div className="swap-card-icon">🔍</div>
                    <h3 className="swap-card-title">SQL Injection Detection</h3>
                    <p className="swap-card-desc">
                      Identifies f-string SQL queries, unsanitized inputs, and raw query execution patterns that AI assistants commonly generate.
                    </p>
                    <div className="swap-card-tags">
                      <span className="swap-tag swap-tag--error">CWE-89</span>
                      <span className="swap-tag swap-tag--warning">OWASP A03</span>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="swap-card-content">
                    <div className="swap-card-icon">🔑</div>
                    <h3 className="swap-card-title">Hardcoded Secrets</h3>
                    <p className="swap-card-desc">
                      Catches JWT secrets, API keys, and credentials embedded directly in source code — a pattern AI loves to produce.
                    </p>
                    <div className="swap-card-tags">
                      <span className="swap-tag swap-tag--error">CWE-798</span>
                      <span className="swap-tag swap-tag--warning">OWASP A07</span>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="swap-card-content">
                    <div className="swap-card-icon">🌐</div>
                    <h3 className="swap-card-title">CORS Misconfiguration</h3>
                    <p className="swap-card-desc">
                      Detects wildcard origins, overly permissive headers, and insecure cross-domain policies in your API middleware.
                    </p>
                    <div className="swap-card-tags">
                      <span className="swap-tag swap-tag--warning">CWE-942</span>
                      <span className="swap-tag swap-tag--warning">OWASP A05</span>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="swap-card-content">
                    <div className="swap-card-icon">🛂</div>
                    <h3 className="swap-card-title">Auth Bypass Detection</h3>
                    <p className="swap-card-desc">
                      Flags unverified JWT decodes, disabled signature checks, and broken authentication flows that compromise security.
                    </p>
                    <div className="swap-card-tags">
                      <span className="swap-tag swap-tag--error">CWE-287</span>
                      <span className="swap-tag swap-tag--warning">OWASP A02</span>
                    </div>
                  </div>
                </Card>
              </CardSwap>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-number">6</span>
              <span className="stat-label">Vulnerabilities Found</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">&lt;1s</span>
              <span className="stat-label">Scan Time</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">3</span>
              <span className="stat-label">Critical Errors</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Local & Private</span>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section" id="detect">
          <h2 className="cta-title">Ready to scan your code?</h2>
          <p className="cta-subtitle">
            See exactly what RedPen catches — from SQL injections to hardcoded secrets.
          </p>
          <div className="cta-button-wrapper">
            <BorderGlow
              edgeSensitivity={30}
              glowColor="350 80 60"
              backgroundColor="#0a0215"
              borderRadius={16}
              glowRadius={40}
              glowIntensity={1.2}
              coneSpread={25}
              animated={false}
              colors={['#ff007a', '#4d3dff', '#38bdf8']}
            >
              <button
                className="detect-button"
                id="detect-button"
                onClick={() => navigate('/results')}
              >
                <img src="/logo.png" alt="" className="detect-button-icon" style={{ height: '20px', width: 'auto' }} />
                Detect Vulnerabilities
                <span className="detect-button-arrow">→</span>
              </button>
            </BorderGlow>
          </div>
        </section>

        {/* Footer */}
        <footer className="site-footer">
          <div className="footer-content">
            <div className="footer-brand">
              <img src="/logo.png" alt="RedPen" className="nav-logo" />
              <span>RedPen</span>
            </div>
            <p className="footer-tagline">Crossing out vulnerabilities AI left behind.</p>
            <div className="footer-divider"></div>
            <p className="footer-copy">Built for hackathon 2026 • RedPen Security</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
