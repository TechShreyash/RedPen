import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import StatsPanel from '../components/StatsPanel';
import VulnerabilityCard from '../components/VulnerabilityCard';
import { getScanResults, pollScanResults } from '../api';
import './ScanResultsPage.css';

export default function ScanResultsPage() {
  const { id } = useParams();
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('severity');
  const [searchQuery, setSearchQuery] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const cancelRef = useRef(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await getScanResults(id);

        if (data) {
          // Results are ready
          const payload = data.results || data;
          setScanData(payload);
          setLoading(false);
        } else {
          // Results not ready yet — start polling
          setPolling(true);
          const { promise, cancel } = pollScanResults(
            id,
            (pollData) => {
              setPollCount(c => c + 1);
              if (pollData) {
                const payload = pollData.results || pollData;
                setScanData(payload);
                setPolling(false);
                setLoading(false);
              }
            },
            { intervalMs: 5000, timeoutMs: 300000 }
          );

          cancelRef.current = cancel;

          promise.catch(err => {
            setError(err.message);
            setPolling(false);
            setLoading(false);
          });
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchResults();

    return () => {
      if (cancelRef.current) cancelRef.current();
    };
  }, [id]);

  // Filter and sort
  const getFilteredResults = () => {
    if (!scanData?.results) return [];

    let filtered = scanData.results;

    if (filter !== 'ALL') {
      filtered = filtered.filter((r) => r.severity === filter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.message?.toLowerCase().includes(q) ||
          r.path?.toLowerCase().includes(q) ||
          r.check_id?.toLowerCase().includes(q) ||
          r.metadata?.cwe?.some((c) => (typeof c === 'string' ? c : JSON.stringify(c)).toLowerCase().includes(q))
      );
    }

    const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 };
    if (sortBy === 'severity') {
      filtered.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
    } else if (sortBy === 'file') {
      filtered.sort((a, b) => a.path.localeCompare(b.path));
    }

    return filtered;
  };

  const filteredResults = getFilteredResults();
  const hasResults = scanData?.results?.length > 0;

  // Loading / Polling state
  if (loading) {
    return (
      <div className="results-page" id="results-page">
        <div className="results-loading">
          <div className="results-loading-icon">
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          </div>
          <h2>{polling ? 'Scanning in progress…' : 'Loading scan results…'}</h2>
          <p className="results-loading-id">Scan ID: <code>{id}</code></p>
          {polling && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginTop: 8 }}>
              Polling for results… (checked {pollCount}×)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="results-page" id="results-page">
        <div className="results-error glass-card">
          <div className="results-error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--severity-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2>Scan Not Found</h2>
          <p>{error}</p>
          <p className="results-error-id">Scan ID: <code>{id}</code></p>
          <a href="/" className="btn btn-primary" style={{ marginTop: 16 }}>← Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="results-page" id="results-page">
      {/* Page Header */}
      <div className="results-page-header animate-fade-in-up">
        <div className="results-page-header-left">
          <h2 className="results-page-title">Scan Results</h2>
          <span className="results-page-id">
            ID: <code>{id}</code>
          </span>
          {scanData?.created_at && (
            <span className="results-page-time">
              {new Date(scanData.created_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Stats Panel */}
      <StatsPanel
        results={scanData.results}
        totalTime={scanData.total_time}
        pathsScanned={scanData.paths_scanned}
      />

      {hasResults ? (
        <>
          {/* Toolbar */}
          <div className="results-toolbar glass-card" id="results-toolbar">
            <div className="results-toolbar-left">
              <div className="filter-tabs" id="severity-filter-tabs">
                {['ALL', 'ERROR', 'WARNING', 'INFO'].map((f) => {
                  const count =
                    f === 'ALL'
                      ? scanData.results.length
                      : scanData.results.filter((r) => r.severity === f).length;
                  return (
                    <button
                      key={f}
                      className={`filter-tab ${filter === f ? 'active' : ''} ${f !== 'ALL' ? `filter-tab-${f.toLowerCase()}` : ''}`}
                      onClick={() => setFilter(f)}
                      id={`filter-tab-${f.toLowerCase()}`}
                    >
                      {f === 'ALL' ? 'All' : f === 'ERROR' ? 'Critical' : f === 'WARNING' ? 'Warning' : 'Info'}
                      <span className="filter-tab-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="results-toolbar-right">
              <div className="search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search findings…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  id="search-input"
                />
              </div>
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                id="sort-select"
              >
                <option value="severity">Sort: Severity</option>
                <option value="file">Sort: File</option>
              </select>
            </div>
          </div>

          {/* Results List */}
          <div className="results-list" id="results-list">
            {filteredResults.length > 0 ? (
              filteredResults.map((finding, i) => (
                <VulnerabilityCard key={`${finding.check_id}-${finding.path}-${i}`} finding={finding} index={i} />
              ))
            ) : (
              <div className="empty-filtered glass-card">
                <p>No findings match your current filters.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="no-findings glass-card animate-fade-in-up" id="no-findings">
          <div className="no-findings-icon">✅</div>
          <h3>No Vulnerabilities Found</h3>
          <p>Great news! The scan completed with no security findings.</p>
        </div>
      )}
    </div>
  );
}
