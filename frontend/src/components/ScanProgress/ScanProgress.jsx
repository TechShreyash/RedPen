import { useState, useEffect, useRef } from 'react';
import './ScanProgress.css';

const SCAN_STEPS = [
  { label: 'Initializing RedPen engine...', duration: 800 },
  { label: 'Parsing abstract syntax tree...', duration: 1200 },
  { label: 'Scanning for injection vulnerabilities...', duration: 1500 },
  { label: 'Checking authentication patterns...', duration: 1000 },
  { label: 'Analyzing CORS configurations...', duration: 900 },
  { label: 'Detecting hardcoded secrets...', duration: 1100 },
  { label: 'Mapping CWE/OWASP references...', duration: 700 },
  { label: 'Generating vulnerability report...', duration: 600 },
];

const ScanProgress = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [vulnCount, setVulnCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (currentStep >= SCAN_STEPS.length) {
      setIsComplete(true);
      // Count up vulnerabilities
      let count = 0;
      const countInterval = setInterval(() => {
        count++;
        setVulnCount(count);
        if (count >= 6) {
          clearInterval(countInterval);
          setTimeout(() => onComplete?.(), 800);
        }
      }, 150);
      return () => clearInterval(countInterval);
    }

    const step = SCAN_STEPS[currentStep];
    const tickInterval = 30;
    const increment = (tickInterval / step.duration) * 100;

    intervalRef.current = setInterval(() => {
      setStepProgress(prev => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(intervalRef.current);
          setTimeout(() => {
            setCurrentStep(s => s + 1);
            setStepProgress(0);
          }, 200);
          return 100;
        }
        return next;
      });
    }, tickInterval);

    return () => clearInterval(intervalRef.current);
  }, [currentStep, onComplete]);

  const overallProgress = ((currentStep + (stepProgress / 100)) / SCAN_STEPS.length) * 100;

  return (
    <div className="scan-progress">
      <div className="scan-progress-card">
        <div className="scan-header">
          <div className="scan-logo">
            <span className="scan-logo-icon">✕</span>
            <span className="scan-logo-text">RedPen</span>
          </div>
          <h2 className="scan-title">
            {isComplete ? 'Scan Complete' : 'Scanning for Vulnerabilities...'}
          </h2>
        </div>

        {/* Overall progress */}
        <div className="scan-overall">
          <div className="scan-overall-bar">
            <div
              className={`scan-overall-fill ${isComplete ? 'scan-overall-fill--done' : ''}`}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          <span className="scan-overall-pct">{Math.round(Math.min(overallProgress, 100))}%</span>
        </div>

        {/* Step list */}
        <div className="scan-steps">
          {SCAN_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep && !isComplete;
            const isPending = idx > currentStep;

            return (
              <div
                key={idx}
                className={`scan-step ${isDone ? 'scan-step--done' : ''} ${isCurrent ? 'scan-step--active' : ''} ${isPending ? 'scan-step--pending' : ''}`}
              >
                <div className="scan-step-indicator">
                  {isDone && <span className="scan-check">✓</span>}
                  {isCurrent && <span className="scan-spinner"></span>}
                  {isPending && <span className="scan-dot"></span>}
                </div>
                <span className="scan-step-label">{step.label}</span>
                {isCurrent && (
                  <div className="scan-step-bar">
                    <div className="scan-step-fill" style={{ width: `${stepProgress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vulnerability count reveal */}
        {isComplete && (
          <div className="scan-result-reveal">
            <div className="scan-result-count">
              <span className="scan-count-number">{vulnCount}</span>
              <span className="scan-count-label">vulnerabilities detected</span>
            </div>
            <div className="scan-severity-breakdown">
              <span className="scan-sev scan-sev--error">3 ERROR</span>
              <span className="scan-sev scan-sev--warning">3 WARNING</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanProgress;
