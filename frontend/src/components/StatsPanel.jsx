import './StatsPanel.css';

export default function StatsPanel({ results, totalTime, pathsScanned }) {
  if (!results) return null;

  const total = results.length;
  const errors = results.filter((r) => r.severity === 'ERROR').length;
  const warnings = results.filter((r) => r.severity === 'WARNING').length;
  const infos = results.filter((r) => r.severity === 'INFO').length;

  // Get unique files affected
  const filesAffected = new Set(results.map((r) => r.path)).size;

  // Get unique CWEs
  const allCwes = new Set();
  results.forEach((r) => {
    (r.metadata?.cwe || []).forEach((c) => allCwes.add(typeof c === 'string' ? c : JSON.stringify(c)));
  });

  const stats = [
    {
      label: 'Total Findings',
      value: total,
      icon: '🔍',
      color: 'var(--text-primary)',
      className: 'stat-total',
    },
    {
      label: 'Critical',
      value: errors,
      icon: '🔴',
      color: 'var(--severity-error)',
      className: 'stat-error',
    },
    {
      label: 'Warnings',
      value: warnings,
      icon: '🟠',
      color: 'var(--severity-warning)',
      className: 'stat-warning',
    },
    {
      label: 'Info',
      value: infos,
      icon: '🔵',
      color: 'var(--severity-info)',
      className: 'stat-info',
    },
  ];

  return (
    <div className="stats-panel" id="stats-panel">
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`stat-card glass-card animate-fade-in-up stagger-${i + 1} ${stat.className}`}
            id={`stat-card-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Additional info bar */}
      <div className="stats-info-bar glass-card animate-fade-in-up stagger-5">
        <div className="stats-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>Scan time: <strong>{typeof totalTime === 'number' ? totalTime.toFixed(2) : totalTime}s</strong></span>
        </div>
        <div className="stats-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <span>Files scanned: <strong>{pathsScanned?.length || 0}</strong></span>
        </div>
        <div className="stats-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>Files affected: <strong>{filesAffected}</strong></span>
        </div>
        <div className="stats-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Unique CWEs: <strong>{allCwes.size}</strong></span>
        </div>
      </div>

      {/* Severity Distribution Bar */}
      {total > 0 && (
        <div className="severity-bar-container animate-fade-in-up stagger-6">
          <div className="severity-bar">
            {errors > 0 && (
              <div
                className="severity-bar-segment severity-bar-error"
                style={{ width: `${(errors / total) * 100}%` }}
                title={`${errors} Critical`}
              />
            )}
            {warnings > 0 && (
              <div
                className="severity-bar-segment severity-bar-warning"
                style={{ width: `${(warnings / total) * 100}%` }}
                title={`${warnings} Warnings`}
              />
            )}
            {infos > 0 && (
              <div
                className="severity-bar-segment severity-bar-info"
                style={{ width: `${(infos / total) * 100}%` }}
                title={`${infos} Info`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
