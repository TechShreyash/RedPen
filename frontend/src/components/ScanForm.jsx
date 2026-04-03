import { useState } from 'react';
import './ScanForm.css';

export default function ScanForm({ onScan, isScanning }) {
  const [targetDir, setTargetDir] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetDir.trim() || isScanning) return;
    onScan(targetDir.trim());
  };

  return (
    <form className="scan-form glass-card" onSubmit={handleSubmit} id="scan-form">
      <div className="scan-form-inner">
        <div className="scan-form-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <input
          type="text"
          className="input scan-form-input"
          placeholder="Enter target directory path to scan…  e.g., D:\MyApp"
          value={targetDir}
          onChange={(e) => setTargetDir(e.target.value)}
          disabled={isScanning}
          id="scan-form-input"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          className="btn btn-primary scan-form-btn"
          disabled={!targetDir.trim() || isScanning}
          id="scan-form-submit"
        >
          {isScanning ? (
            <>
              <div className="spinner" />
              Scanning…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Scan
            </>
          )}
        </button>
      </div>

      {/* Scanning animation overlay */}
      {isScanning && (
        <div className="scan-progress">
          <div className="scan-progress-bar" />
          <span className="scan-progress-text">Analyzing security vulnerabilities…</span>
        </div>
      )}
    </form>
  );
}
