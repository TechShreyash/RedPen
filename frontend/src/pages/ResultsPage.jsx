import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ShapeGrid from '../components/ShapeGrid/ShapeGrid';
import FileTree from '../components/FileTree/FileTree';
import CodeViewer from '../components/CodeViewer/CodeViewer';
import ScanProgress from '../components/ScanProgress/ScanProgress';
import RemediationModal from '../components/RemediationModal/RemediationModal';
import { getFileStructure, pollScanResults } from '../api';
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
  const [fileStructure, setFileStructure] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanStatus, setScanStatus] = useState('initializing'); // initializing | polling | complete | error
  const [pollCount, setPollCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedVuln, setSelectedVuln] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const cancelPollRef = useRef(null);
  const [showRemediation, setShowRemediation] = useState(false);
  const [selectedRemediationVuln, setSelectedRemediationVuln] = useState(null);

  // Step 1: Load file structure (this always exists as soon as scan_id is created)
  useEffect(() => {
    if (!scanId) {
      // No scan_id — load demo data
      fetch('/result.json')
        .then(res => res.json())
        .then(data => {
          setScanData(data);
          setScanStatus('complete');
        })
        .catch(err => {
          console.error('Failed to load results:', err);
          setLoadError('Failed to load demo data');
          setScanStatus('error');
        });
      return;
    }

    // Fetch file structure first
    getFileStructure(scanId)
      .then(data => {
        setFileStructure(data);
        setScanStatus('polling');
      })
      .catch(err => {
        console.error('Failed to load file structure:', err);
        setLoadError(err.message);
        setScanStatus('error');
      });
  }, [scanId]);

  // Step 2: Once we have the file structure, start polling for results every 10s
  useEffect(() => {
    if (scanStatus !== 'polling' || !scanId) return;

    const { promise, cancel } = pollScanResults(
      scanId,
      (data) => {
        // Called after each poll attempt
        setPollCount(c => c + 1);
        if (data) {
          // Results received — normalize the shape
          const payload = data.results || data;
          setScanData(payload);
          setScanStatus('complete');
        }
      },
      { intervalMs: 10000, timeoutMs: 300000 } // Poll every 10 seconds
    );

    cancelPollRef.current = cancel;

    promise.catch(err => {
      if (err.message !== 'Scan timed out') {
        console.error('Polling error:', err);
      }
      if (!scanData) {
        setLoadError(err.message);
        setScanStatus('error');
      }
    });

    return () => cancel();
  }, [scanStatus, scanId]);

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

  // Show the ScanProgress while polling
  if (isScanning) {
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

        {/* Navbar */}
        <nav className="results-nav" id="results-nav">
          <button className="back-button" id="back-home" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="results-nav-brand">
            <img src="/logo.png" alt="RedPen" className="results-nav-logo" />
            <span className="results-nav-title">RedPen</span>
          </div>
          <div className="results-nav-stats">
            {scanId && (
              <span className="nav-stat nav-stat--time" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                ID: {scanId}
              </span>
            )}
          </div>
        </nav>

        <div className="results-content-wrapper">
          <ScanProgress
            onComplete={handleScanComplete}
            scanStatus={scanStatus}
            scanData={scanData}
            fileStructure={fileStructure}
            pollCount={pollCount}
          />
        </div>
      </div>
    );
  }

  // Still loading scan data after scan animation finished
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
          <p>{scanId ? `Waiting for scan results…` : 'Loading scan data...'}</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: 8 }}>
            The scanner is still processing your files.
          </p>
        </div>
      </div>
    );
  }

  // Normalize results — handle both { results: { results: [...] } } and { results: [...] }
  const resultsArray = Array.isArray(scanData.results)
    ? scanData.results
    : (scanData.results?.results || []);
  const pathsScanned = scanData.paths_scanned || scanData.results?.paths_scanned || [];
  const totalTime = scanData.total_time || scanData.results?.total_time || 0;

  const fileTree = buildFileTree(pathsScanned);
  const errorFileIds = [...new Set(resultsArray.map(r => r.path))];
  const expandedFolders = [...new Set(
    pathsScanned
      .filter(p => p.includes('/'))
      .map(p => p.split('/').slice(0, -1).join('/'))
  )];

  // Get vulnerabilities for selected file
  const fileVulns = selectedFile
    ? resultsArray.filter(r => r.path === selectedFile)
    : [];

  // Which vulns to display in the main area:
  // - If a specific vuln was clicked → show only that one
  // - If a file was selected from tree → show ALL vulns for that file
  const displayVulns = selectedVuln
    ? [selectedVuln]
    : fileVulns;

  const getHighlightLines = (vuln) =>
    vuln
      ? Array.from(
          { length: vuln.snippet_lines.end - vuln.snippet_lines.start + 1 },
          (_, i) => vuln.snippet_lines.start + i
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
              {resultsArray.filter(r => r.severity === 'ERROR').length} Errors
            </span>
            <span className="nav-stat nav-stat--warning">
              {resultsArray.filter(r => r.severity === 'WARNING').length} Warnings
            </span>
            <span className="nav-stat nav-stat--time">
              {totalTime.toFixed(1)}s scan
            </span>
          </div>
        )}
      </nav>

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
                  <span>Vulnerabilities ({resultsArray.length})</span>
                </div>
                <div className="vuln-list-items">
                  {resultsArray.map((vuln, idx) => (
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
                      <div className="vuln-item-title-row">
                        <span className="vuln-item-title">{vuln.title || vuln.check_id.split('.').pop().replace(/-/g, ' ')}</span>
                      </div>
                      <p className="vuln-message">{vuln.message.slice(0, 90)}...</p>
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
              ) : displayVulns.length > 0 ? (
                <>
                  {/* File header when showing multiple vulns */}
                  {!selectedVuln && fileVulns.length > 1 && (
                    <div className="file-vulns-header">
                      <span className="file-vulns-header-icon">📄</span>
                      <span className="file-vulns-header-path">{selectedFile}</span>
                      <span className="file-vulns-header-count">
                        {fileVulns.length} vulnerabilit{fileVulns.length > 1 ? 'ies' : 'y'}
                      </span>
                    </div>
                  )}

                  {displayVulns.map((vuln, vIdx) => (
                    <div key={`${vuln.check_id}-${vuln.snippet_lines?.start}-${vIdx}`} className="vuln-block">
                      {/* Code viewer */}
                      <CodeViewer
                        code={vuln.snippet_extended || ''}
                        startLine={vuln.snippet_extended_lines?.start || 1}
                        highlightLines={getHighlightLines(vuln)}
                        filename={vuln.path}
                        language="python"
                        vulnerabilities={[vuln]}
                      />

                      {/* Vulnerability details */}
                      <div className="vuln-details">
                        <div className="vuln-details-header">
                          <div className="vuln-details-sev-wrap">
                            <span className={`vuln-details-severity ${getSeverityClass(vuln.severity)}`}>
                              {getSeverityIcon(vuln.severity)} {vuln.severity}
                            </span>
                            {vuln.metadata.likelihood && (
                              <span className="vuln-likelihood">
                                Likelihood: {vuln.metadata.likelihood}
                              </span>
                            )}
                            {vuln.metadata.impact && (
                              <span className="vuln-impact">
                                Impact: {vuln.metadata.impact}
                              </span>
                            )}
                          </div>
                          <h3 className="vuln-details-title">
                            {vuln.title || vuln.check_id.split('.').pop().replace(/-/g, ' ')}
                          </h3>
                        </div>

                        <p className="vuln-details-message">{vuln.message}</p>

                        <div className="vuln-details-meta">
                          <div className="vuln-meta-group">
                            <h4>CWE References</h4>
                            <div className="vuln-meta-tags">
                              {vuln.metadata.cwe?.map((cwe, i) => (
                                <span key={i} className="vuln-meta-tag vuln-meta-tag--cwe">{cwe}</span>
                              ))}
                            </div>
                          </div>

                          <div className="vuln-meta-group">
                            <h4>OWASP Classification</h4>
                            <div className="vuln-meta-tags">
                              {vuln.metadata.owasp?.map((owasp, i) => (
                                <span key={i} className="vuln-meta-tag vuln-meta-tag--owasp">{owasp}</span>
                              ))}
                            </div>
                          </div>

                          {vuln.metadata.references?.length > 0 && (
                            <div className="vuln-meta-group">
                              <h4>References</h4>
                              <div className="vuln-meta-links">
                                {vuln.metadata.references.map((ref, i) => (
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
                                <span className="vuln-detail-value">{vuln.check_id}</span>
                              </div>
                              <div className="vuln-detail-item">
                                <span className="vuln-detail-label">File</span>
                                <span className="vuln-detail-value">{vuln.path}</span>
                              </div>
                              <div className="vuln-detail-item">
                                <span className="vuln-detail-label">Lines</span>
                                <span className="vuln-detail-value">{vuln.snippet_lines.start}–{vuln.snippet_lines.end}</span>
                              </div>
                              <div className="vuln-detail-item">
                                <span className="vuln-detail-label">Confidence</span>
                                <span className="vuln-detail-value">{vuln.metadata.confidence}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fix with AI Button */}
                      <div className="vuln-details-fix-action">
                        <button
                          className="vuln-details-fix-btn"
                          onClick={() => { setSelectedRemediationVuln(vuln); setShowRemediation(true); }}
                          id={`results-fix-btn-${vIdx}`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          Fix with AI
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : selectedFile ? (
                <div className="results-empty">
                  <div className="results-empty-icon">✅</div>
                  <h2>No vulnerabilities</h2>
                  <p>This file has no detected security issues.</p>
                </div>
              ) : null}
            </main>
          </div>

          {/* Remediation Modal */}
          {showRemediation && selectedRemediationVuln && (
            <RemediationModal
              finding={selectedRemediationVuln}
              onClose={() => { setShowRemediation(false); setSelectedRemediationVuln(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
