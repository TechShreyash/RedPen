import './SeverityBadge.css';

const SEVERITY_MAP = {
  ERROR: { label: 'Critical', className: 'badge-error', icon: '🔴' },
  WARNING: { label: 'Warning', className: 'badge-warning', icon: '🟠' },
  INFO: { label: 'Info', className: 'badge-info', icon: '🔵' },
};

export default function SeverityBadge({ severity }) {
  const config = SEVERITY_MAP[severity] || SEVERITY_MAP.INFO;

  return (
    <span className={`badge severity-badge ${config.className}`} id={`severity-badge-${severity?.toLowerCase()}`}>
      <span className="severity-dot" />
      {config.label}
    </span>
  );
}
