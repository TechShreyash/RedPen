import { useState, useEffect, useRef } from 'react';
import { remediateFinding } from '../../api';
import './RemediationModal.css';

export default function RemediationModal({ finding, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fixData, setFixData] = useState(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!finding) return;

    const fetchFix = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await remediateFinding(finding);
        setFixData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFix();
  }, [finding]);

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const severityClass = finding?.severity === 'ERROR' ? 'severity-error'
    : finding?.severity === 'WARNING' ? 'severity-warning' : 'severity-info';

  return (
    <div className="remediation-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="remediation-modal" id="remediation-modal">
        {/* Header */}
        <div className="remediation-header">
          <div className="remediation-header-left">
            <div className="remediation-icon">🛡️</div>
            <div>
              <h2 className="remediation-title">AI Fix Suggestion</h2>
              <span className="remediation-subtitle">
                {finding?.check_id?.split('.').pop().replace(/-/g, ' ')}
              </span>
            </div>
          </div>
          <button className="remediation-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Finding summary */}
        <div className="remediation-finding-bar">
          <span className={`remediation-severity ${severityClass}`}>
            {finding?.severity}
          </span>
          <span className="remediation-file">{finding?.path}</span>
          <span className="remediation-lines">
            L{finding?.snippet_lines?.start}-{finding?.snippet_lines?.end}
          </span>
        </div>

        {/* Content */}
        <div className="remediation-body">
          {loading && (
            <div className="remediation-loading">
              <div className="remediation-spinner" />
              <p>Generating AI fix with Gemini...</p>
              <span className="remediation-loading-sub">Analyzing vulnerability and producing secure code</span>
            </div>
          )}

          {error && (
            <div className="remediation-error">
              <div className="remediation-error-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h3>Remediation Failed</h3>
              <p>{error}</p>
              <button className="remediation-retry-btn" onClick={() => {
                setError(null);
                setLoading(true);
                remediateFinding(finding)
                  .then(setFixData)
                  .catch(err => setError(err.message))
                  .finally(() => setLoading(false));
              }}>
                ↻ Retry
              </button>
            </div>
          )}

          {fixData && !loading && !error && (
            <div className="remediation-result">
              {/* Explanation */}
              <div className="remediation-section">
                <h3 className="remediation-section-title">
                  <span className="section-icon">💡</span> Explanation
                </h3>
                <p className="remediation-explanation">{fixData.explanation}</p>
              </div>

              {/* Security Note */}
              {fixData.security_note && (
                <div className="remediation-section remediation-note">
                  <h3 className="remediation-section-title">
                    <span className="section-icon">⚠️</span> Security Note
                  </h3>
                  <p className="remediation-note-text">{fixData.security_note}</p>
                </div>
              )}

              {/* Fixed Code */}
              <div className="remediation-section">
                <div className="remediation-code-header">
                  <h3 className="remediation-section-title">
                    <span className="section-icon">✅</span> Fixed Code
                  </h3>
                  <button
                    className="remediation-copy-btn"
                    onClick={() => handleCopy(fixData.fixed_code)}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Code'}
                  </button>
                </div>
                <pre className="remediation-code">
                  <code>{fixData.fixed_code}</code>
                </pre>
              </div>

              {/* Diff */}
              {fixData.diff && (
                <div className="remediation-section">
                  <h3 className="remediation-section-title">
                    <span className="section-icon">📄</span> Diff
                  </h3>
                  <pre className="remediation-diff">
                    <code>
                      {fixData.diff.split('\n').map((line, i) => (
                        <span key={i} className={
                          line.startsWith('+') ? 'diff-add'
                            : line.startsWith('-') ? 'diff-remove'
                              : line.startsWith('@@') ? 'diff-header'
                                : 'diff-context'
                        }>
                          {line + '\n'}
                        </span>
                      ))}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
