import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ShapeGrid from '../components/ShapeGrid/ShapeGrid';
import FileTree from '../components/FileTree/FileTree';
import CodeViewer from '../components/CodeViewer/CodeViewer';
import ScanProgress from '../components/ScanProgress/ScanProgress';
import { getScanResults } from '../api';
import './ResultsPage.css';

// Build file tree from scanned paths
const buildFileTree = (paths) => {
  const root = [];
  const folderMap = {};

  paths.forEach(filePath => {
    const parts = filePath.split('/');
    let currentChildren = root;

    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      const fullPath = parts.slice(0, idx + 1).join('/');

      if (isFile) {
        currentChildren.push({
          id: fullPath,
          name: part,
          isSelectable: true,
        });
      } else {
        if (!folderMap[fullPath]) {
          const folder = {
            id: fullPath,
            type: 'folder',
            name: part,
            isSelectable: true,
            children: [],
          };
          folderMap[fullPath] = folder;
          currentChildren.push(folder);
        }
        currentChildren = folderMap[fullPath].children;
      }
    });
  });

  return root;
};

const getSeverityClass = (severity) => {
  switch (severity) {
    case 'ERROR': return 'severity--error';
    case 'WARNING': return 'severity--warning';
    default: return 'severity--info';
  }
};

const getSeverityIcon = (severity) => {
  switch (severity) {
    case 'ERROR': return '🔴';
    case 'WARNING': return '🟡';
    default: return '🔵';
  }
};

const ResultsPage = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const scanId = paramId || searchParams.get('id');

  const [scanData, setScanData] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load scan data — from backend if we have an ID, else static demo file
  useEffect(() => {
    if (scanId) {
      getScanResults(scanId)
        .then(data => {
          // Backend wraps scan results in { scan_id, results: { results, paths_scanned, total_time } }
          const payload = data.results || data;
          setScanData(payload);
        })
        .catch(err => {
          console.error('Failed to load scan results:', err);
          setLoadError(err.message);
        });
    } else {
      // Fallback: load the static demo result.json
      fetch('/result.json')
        .then(res => res.json())
        .then(data => setScanData(data))
        .catch(err => {
          console.error('Failed to load results:', err);
          setLoadError('Failed to load demo data');
        });
    }
  }, [scanId]);

  const handleScanComplete = useCallback(() => {
    setIsScanning(false);
    setTimeout(() => setShowResults(true), 300);
  }, []);

  const handleFileSelect = useCallback((fileId) => {
    setSelectedFile(fileId);
    setSelectedVuln(null);
  }, []);

  const handleVulnClick = useCallback((vuln) => {
    setSelectedVuln(vuln);
    setSelectedFile(vuln.path);
  }, []);

  if (loadError) {
    return (
      <div className="results-page">
        <div className="results-bg">
          <ShapeGrid
            speed={0.35}
            squareSize={40}
            direction="diagonal"
            borderColor="#271E37"
            hoverFillColor="#222222"
            shape="hexagon"
          />
        </div>
        <div className="results-loading">
          <div className="results-empty-icon" style={{ fontSize: '2.5rem' }}>❌</div>
          <h2 style={{ color: '#fff', marginBottom: 8 }}>Scan Not Found</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>{loadError}</p>
          <button
            className="back-button"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!scanData) {
    return (
      <div className="results-page">
        <div className="results-bg">
          <ShapeGrid
            speed={0.35}
            squareSize={40}
            direction="diagonal"
            borderColor="#271E37"
            hoverFillColor="#222222"
            shape="hexagon"
          />
        </div>
        <div className="results-loading">
          <div className="results-spinner"></div>
          <p>{scanId ? `Loading scan ${scanId}…` : 'Loading scan data...'}</p>
        </div>
      </div>
    );
  }

  const fileTree = buildFileTree(scanData.paths_scanned);
  const errorFileIds = [...new Set(scanData.results.map(r => r.path))];
  const expandedFolders = [...new Set(
    scanData.paths_scanned
      .filter(p => p.includes('/'))
      .map(p => p.split('/').slice(0, -1).join('/'))
  )];

  // Get vulnerabilities for selected file
  const fileVulns = selectedFile
    ? scanData.results.filter(r => r.path === selectedFile)
    : [];

  // Get code to display
  const displayVuln = selectedVuln || (fileVulns.length > 0 ? fileVulns[0] : null);
  const codeToShow = displayVuln?.snippet_extended || '';
  const codeStartLine = displayVuln?.snippet_extended_lines?.start || 1;
  const highlightLines = displayVuln
    ? Array.from(
        { length: displayVuln.snippet_lines.end - displayVuln.snippet_lines.start + 1 },
        (_, i) => displayVuln.snippet_lines.start + i
      )
    : [];

  return (
    <div className="results-page">
      {/* Background */}
      <div className="results-bg">
        <ShapeGrid
          speed={0.35}
          squareSize={40}
          direction="diagonal"
          borderColor="#271E37"
          hoverFillColor="#222222"
          shape="hexagon"
        />
      </div>

      {/* Navbar */}
      <nav className="results-nav" id="results-nav">
        <button className="back-button" id="back-home" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="results-nav-brand">
          <img src="/logo.png" alt="RedPen" className="results-nav-logo" />
          <span className="results-nav-title">RedPen</span>
        </div>
        {showResults && (
          <div className="results-nav-stats">
            <span className="nav-stat nav-stat--error">
              {scanData.results.filter(r => r.severity === 'ERROR').length} Errors
            </span>
            <span className="nav-stat nav-stat--warning">
              {scanData.results.filter(r => r.severity === 'WARNING').length} Warnings
            </span>
            <span className="nav-stat nav-stat--time">
              {scanData.total_time.toFixed(1)}s scan
            </span>
          </div>
        )}
      </nav>

      {/* Scanning animation */}
      {isScanning && (
        <div className="results-content-wrapper">
          <ScanProgress onComplete={handleScanComplete} />
        </div>
      )}

      {/* Results view */}
      {showResults && (
        <div className="results-content-wrapper results-fade-in">
          <div className="results-layout">
            {/* Left sidebar */}
            <aside className="results-sidebar">
              <FileTree
                elements={fileTree}
                initialSelectedId={selectedFile}
                initialExpandedItems={expandedFolders}
                onSelectFile={handleFileSelect}
                errorFileIds={errorFileIds}
              />

              {/* Vulnerability list */}
              <div className="vuln-list">
                <div className="vuln-list-header">
                  <span className="vuln-list-icon">⚠</span>
                  <span>Vulnerabilities ({scanData.results.length})</span>
                </div>
                <div className="vuln-list-items">
                  {scanData.results.map((vuln, idx) => (
                    <div
                      key={idx}
                      className={`vuln-item ${selectedVuln?.check_id === vuln.check_id && selectedVuln?.snippet_lines?.start === vuln.snippet_lines?.start ? 'vuln-item--selected' : ''}`}
                      onClick={() => handleVulnClick(vuln)}
                      id={`vuln-item-${idx}`}
                    >
                      <div className="vuln-item-top">
                        <span className={`vuln-severity ${getSeverityClass(vuln.severity)}`}>
                          {getSeverityIcon(vuln.severity)} {vuln.severity}
                        </span>
                        <span className="vuln-file">{vuln.path.split('/').pop()}</span>
                      </div>
                      <p className="vuln-message">{vuln.message.slice(0, 80)}...</p>
                      <div className="vuln-tags">
                        {vuln.metadata.cwe?.slice(0, 1).map((cwe, i) => (
                          <span key={i} className="vuln-cwe-tag">
                            {cwe.split(':')[0]}
                          </span>
                        ))}
                        <span className="vuln-line-tag">
                          L{vuln.snippet_lines.start}-{vuln.snippet_lines.end}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main content area */}
            <main className="results-main">
              {!selectedFile && !selectedVuln ? (
                <div className="results-empty">
                  <div className="results-empty-icon">🔍</div>
                  <h2>Select a file or vulnerability</h2>
                  <p>Click on a file in the tree or a vulnerability from the list to view the code and details.</p>
                </div>
              ) : (
                <>
                  {/* Code viewer */}
                  {displayVuln && (
                    <CodeViewer
                      code={codeToShow}
                      startLine={codeStartLine}
                      highlightLines={highlightLines}
                      filename={displayVuln.path}
                      language="python"
                      vulnerabilities={fileVulns}
                    />
                  )}

                  {/* Vulnerability details */}
                  {displayVuln && (
                    <div className="vuln-details">
                      <div className="vuln-details-header">
                        <div className="vuln-details-sev-wrap">
                          <span className={`vuln-details-severity ${getSeverityClass(displayVuln.severity)}`}>
                            {getSeverityIcon(displayVuln.severity)} {displayVuln.severity}
                          </span>
                          {displayVuln.metadata.likelihood && (
                            <span className="vuln-likelihood">
                              Likelihood: {displayVuln.metadata.likelihood}
                            </span>
                          )}
                          {displayVuln.metadata.impact && (
                            <span className="vuln-impact">
                              Impact: {displayVuln.metadata.impact}
                            </span>
                          )}
                        </div>
                        <h3 className="vuln-details-title">{displayVuln.check_id.split('.').pop()}</h3>
                      </div>

                      <p className="vuln-details-message">{displayVuln.message}</p>

                      <div className="vuln-details-meta">
                        <div className="vuln-meta-group">
                          <h4>CWE References</h4>
                          <div className="vuln-meta-tags">
                            {displayVuln.metadata.cwe?.map((cwe, i) => (
                              <span key={i} className="vuln-meta-tag vuln-meta-tag--cwe">{cwe}</span>
                            ))}
                          </div>
                        </div>

                        <div className="vuln-meta-group">
                          <h4>OWASP Classification</h4>
                          <div className="vuln-meta-tags">
                            {displayVuln.metadata.owasp?.map((owasp, i) => (
                              <span key={i} className="vuln-meta-tag vuln-meta-tag--owasp">{owasp}</span>
                            ))}
                          </div>
                        </div>

                        {displayVuln.metadata.references?.length > 0 && (
                          <div className="vuln-meta-group">
                            <h4>References</h4>
                            <div className="vuln-meta-links">
                              {displayVuln.metadata.references.map((ref, i) => (
                                <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="vuln-ref-link">
                                  {new URL(ref).hostname} ↗
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="vuln-meta-group">
                          <h4>Detection Info</h4>
                          <div className="vuln-details-grid">
                            <div className="vuln-detail-item">
                              <span className="vuln-detail-label">Rule ID</span>
                              <span className="vuln-detail-value">{displayVuln.check_id}</span>
                            </div>
                            <div className="vuln-detail-item">
                              <span className="vuln-detail-label">File</span>
                              <span className="vuln-detail-value">{displayVuln.path}</span>
                            </div>
                            <div className="vuln-detail-item">
                              <span className="vuln-detail-label">Lines</span>
                              <span className="vuln-detail-value">{displayVuln.snippet_lines.start}–{displayVuln.snippet_lines.end}</span>
                            </div>
                            <div className="vuln-detail-item">
                              <span className="vuln-detail-label">Confidence</span>
                              <span className="vuln-detail-value">{displayVuln.metadata.confidence}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File vulns list when no vuln selected but file is */}
                  {!displayVuln && fileVulns.length === 0 && selectedFile && (
                    <div className="results-empty">
                      <div className="results-empty-icon">✅</div>
                      <h2>No vulnerabilities</h2>
                      <p>This file has no detected security issues.</p>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
