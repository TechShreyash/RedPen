import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './ScanProgress.css';

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

/** Build a nested tree from flat file paths */
const buildTree = (paths) => {
  const root = { name: 'root', type: 'folder', children: [], path: '' };
  const folderMap = { '': root };

  const sorted = [...paths].sort((a, b) => {
    const aParts = a.split('/');
    const bParts = b.split('/');
    // Folders first, then alphabetical
    if (aParts.length !== bParts.length) return aParts.length - bParts.length;
    return a.localeCompare(b);
  });

  sorted.forEach(filePath => {
    const parts = filePath.split('/');
    let current = root;

    parts.forEach((part, idx) => {
      const fullPath = parts.slice(0, idx + 1).join('/');
      const isFile = idx === parts.length - 1;

      if (isFile) {
        current.children.push({
          name: part,
          type: 'file',
          path: filePath,
          children: [],
        });
      } else {
        if (!folderMap[fullPath]) {
          const folder = {
            name: part,
            type: 'folder',
            path: fullPath,
            children: [],
          };
          folderMap[fullPath] = folder;
          current.children.push(folder);
        }
        current = folderMap[fullPath];
      }
    });
  });

  // Sort: folders first, then files, both alphabetical
  const sortChildren = (node) => {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  return root.children;
};

/** Get file icon based on extension */
const getFileIcon = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    js: '📜', jsx: '⚛️', ts: '🔷', tsx: '🔷',
    py: '🐍', json: '📋', md: '📖', css: '🎨',
    html: '🌐', sh: '⚡', txt: '📄', yml: '⚙️', yaml: '⚙️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', svg: '🖼️',
    lock: '🔒', gitignore: '👁️', env: '🔐',
    toml: '⚙️', cfg: '⚙️', ini: '⚙️',
    pyc: '📦', Dockerfile: '🐳',
  };
  if (name === 'Dockerfile') return '🐳';
  return icons[ext] || '📄';
};

/** Get extension color */
const getExtColor = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  const colors = {
    js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
    py: '#3b82f6', json: '#6b7280', md: '#6b7280', css: '#a855f7',
    html: '#e34f26', sh: '#22c55e', lock: '#475569',
  };
  return colors[ext] || '#64748b';
};

/* ────────────────────────────────────────────────
   TreeNode component
   ──────────────────────────────────────────────── */
const TreeNode = ({ node, depth = 0, scannedFiles, currentFile, expandedFolders }) => {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(node.path);

  // File status
  let status = 'pending'; // pending | scanning | done
  if (!isFolder) {
    if (scannedFiles.has(node.path)) status = 'done';
    else if (currentFile === node.path) status = 'scanning';
  }

  // Folder status
  let folderStatus = 'pending';
  if (isFolder) {
    const allFiles = getAllFiles(node);
    const doneCount = allFiles.filter(f => scannedFiles.has(f)).length;
    const hasScanning = allFiles.some(f => f === currentFile);
    if (doneCount === allFiles.length && allFiles.length > 0) folderStatus = 'done';
    else if (doneCount > 0 || hasScanning) folderStatus = 'scanning';
  }

  return (
    <div className="sp-tree-node">
      <div
        className={`sp-tree-item sp-tree-item--${isFolder ? folderStatus : status}`}
        style={{ paddingLeft: `${depth * 18 + 12}px` }}
      >
        {/* Indicator */}
        <div className="sp-tree-indicator">
          {status === 'scanning' || (isFolder && folderStatus === 'scanning') ? (
            <span className="sp-scan-spinner" />
          ) : status === 'done' || (isFolder && folderStatus === 'done') ? (
            <span className="sp-scan-check">✓</span>
          ) : (
            <span className="sp-scan-dot" />
          )}
        </div>

        {/* Icon */}
        {isFolder ? (
          <span className={`sp-folder-icon ${isExpanded ? 'sp-folder-icon--open' : ''}`}>
            {isExpanded ? '📂' : '📁'}
          </span>
        ) : (
          <span className="sp-file-icon" style={{ color: getExtColor(node.name) }}>
            {getFileIcon(node.name)}
          </span>
        )}

        {/* Name */}
        <span className={`sp-tree-name ${status === 'scanning' ? 'sp-tree-name--active' : ''} ${status === 'done' ? 'sp-tree-name--done' : ''}`}>
          {node.name}
        </span>

        {/* Scanning shimmer bar */}
        {status === 'scanning' && (
          <div className="sp-file-progress">
            <div className="sp-file-progress-fill" />
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && node.children.length > 0 && (
        <div className="sp-tree-children">
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.path || `${node.path}/${child.name}-${idx}`}
              node={child}
              depth={depth + 1}
              scannedFiles={scannedFiles}
              currentFile={currentFile}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Get all file paths from a tree node */
function getAllFiles(node) {
  if (node.type === 'file') return [node.path];
  return (node.children || []).flatMap(getAllFiles);
}

/** Get all folder paths from a tree */
function getAllFolders(nodes) {
  const folders = new Set();
  const walk = (n) => {
    if (n.type === 'folder') {
      folders.add(n.path);
      (n.children || []).forEach(walk);
    }
  };
  nodes.forEach(walk);
  return folders;
}

/** Get the folder path containing a file */
function getParentFolders(filePath) {
  const parts = filePath.split('/');
  const folders = [];
  for (let i = 1; i < parts.length; i++) {
    folders.push(parts.slice(0, i).join('/'));
  }
  return folders;
}

/* ────────────────────────────────────────────────
   Main ScanProgress component
   ──────────────────────────────────────────────── */

/**
 * Props:
 *   onComplete      – fires when animation finishes AND results are ready
 *   scanStatus      – 'initializing' | 'polling' | 'complete' | 'error'
 *   scanData        – the actual scan result payload (null while scanning)
 *   fileStructure   – { files: [...] } from the API
 *   pollCount       – how many times we've polled
 */
const ScanProgress = ({ onComplete, scanStatus, scanData, fileStructure, pollCount }) => {
  const [scannedFiles, setScannedFiles] = useState(new Set());
  const [currentFile, setCurrentFile] = useState(null);
  const [phase, setPhase] = useState('init'); // init | scanning | finalizing | complete
  const [overallProgress, setOverallProgress] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [vulnCount, setVulnCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const hasCompletedRef = useRef(false);
  const fileIndexRef = useRef(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const scanCompleteRef = useRef(false);

  const files = useMemo(() => fileStructure?.files || [], [fileStructure]);
  const tree = useMemo(() => buildTree(files), [files]);
  const totalFiles = files.length;

  // Elapsed time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate per-file delay: target ~55-65s total, but adapt
  const getFileDelay = useCallback(() => {
    if (totalFiles === 0) return 1000;
    // Target about 55 seconds for file scanning phase
    // (init takes ~3s, finalize takes ~3s)
    const targetScanTime = 55000;
    const baseDelay = targetScanTime / totalFiles;
    // Add some randomness for realism
    const jitter = (Math.random() - 0.5) * baseDelay * 0.6;
    // But if scan is done, speed up remaining
    if (scanData) {
      return Math.min(150 + Math.random() * 100, baseDelay * 0.15);
    }
    return Math.max(400, Math.min(baseDelay + jitter, 4000));
  }, [totalFiles, scanData]);

  // Phase: init
  useEffect(() => {
    if (files.length === 0) return;
    // Expand all folders at start
    setExpandedFolders(getAllFolders(tree));

    const timer = setTimeout(() => {
      setPhase('scanning');
      setOverallProgress(5);
    }, 1500);
    return () => clearTimeout(timer);
  }, [files, tree]);

  // Phase: scanning — animate through files one by one
  useEffect(() => {
    if (phase !== 'scanning' || files.length === 0) return;

    const scanNextFile = () => {
      const idx = fileIndexRef.current;
      if (idx >= files.length) {
        setPhase('finalizing');
        return;
      }

      const file = files[idx];
      setCurrentFile(file);

      // Auto-expand parent folders
      const parents = getParentFolders(file);
      setExpandedFolders(prev => {
        const next = new Set(prev);
        parents.forEach(p => next.add(p));
        return next;
      });

      const delay = getFileDelay();

      timerRef.current = setTimeout(() => {
        setScannedFiles(prev => {
          const next = new Set(prev);
          next.add(file);
          return next;
        });
        fileIndexRef.current = idx + 1;
        setOverallProgress(5 + ((idx + 1) / files.length) * 85);
        scanNextFile();
      }, delay);
    };

    scanNextFile();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, files, getFileDelay]);

  // Phase: finalizing
  useEffect(() => {
    if (phase !== 'finalizing') return;
    setCurrentFile(null);
    setOverallProgress(92);

    if (scanData) {
      // Results already here — go straight to complete
      setTimeout(() => {
        setOverallProgress(100);
        setPhase('complete');
      }, 800);
    }
    // Otherwise wait for scanData to arrive
  }, [phase, scanData]);

  // When scanData arrives during finalizing
  useEffect(() => {
    if (phase === 'finalizing' && scanData && !scanCompleteRef.current) {
      scanCompleteRef.current = true;
      setTimeout(() => {
        setOverallProgress(100);
        setPhase('complete');
      }, 600);
    }
  }, [phase, scanData]);

  // When scanData arrives during scanning — speed up remaining
  useEffect(() => {
    if (phase === 'scanning' && scanData) {
      // getFileDelay will now return much shorter delays via the scanData check
    }
  }, [phase, scanData]);

  // Phase: complete — count up vulns, then fire onComplete
  useEffect(() => {
    if (phase !== 'complete' || hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    const totalVulns = scanData?.results?.results?.length || scanData?.results?.length || 0;

    if (totalVulns === 0) {
      setVulnCount(0);
      setTimeout(() => onComplete?.(), 1200);
    } else {
      let count = 0;
      const countInterval = setInterval(() => {
        count++;
        setVulnCount(count);
        if (count >= totalVulns) {
          clearInterval(countInterval);
          setTimeout(() => onComplete?.(), 1200);
        }
      }, Math.max(40, 600 / Math.max(totalVulns, 1)));
    }
  }, [phase, scanData, onComplete]);

  // Derive stats
  const results = scanData?.results?.results || scanData?.results || [];
  const totalErrors = results.filter?.(r => r.severity === 'ERROR').length || 0;
  const totalWarnings = results.filter?.(r => r.severity === 'WARNING').length || 0;
  const scanTime = scanData?.results?.total_time || scanData?.total_time;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="sp-container">
      <div className="sp-card">
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header-top">
            <div className="sp-header-brand">
              <span className="sp-logo-x">✕</span>
              <span className="sp-logo-text">RedPen Scanner</span>
            </div>
            <div className="sp-header-timer">
              <span className="sp-timer-icon">⏱</span>
              <span className="sp-timer-value">{formatTime(elapsedTime)}</span>
            </div>
          </div>

          <h2 className="sp-title">
            {phase === 'init' && 'Initializing scan engine...'}
            {phase === 'scanning' && 'Scanning for vulnerabilities...'}
            {phase === 'finalizing' && (scanData ? 'Generating report...' : 'Waiting for scan results...')}
            {phase === 'complete' && 'Scan Complete'}
          </h2>

          <div className="sp-stats-row">
            <span className="sp-stat">
              <span className="sp-stat-num">{totalFiles}</span> files
            </span>
            <span className="sp-stat-sep">•</span>
            <span className="sp-stat">
              <span className="sp-stat-num">{scannedFiles.size}</span> scanned
            </span>
            {pollCount > 0 && (
              <>
                <span className="sp-stat-sep">•</span>
                <span className="sp-stat sp-stat--poll">
                  {pollCount} poll{pollCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="sp-progress-section">
          <div className="sp-progress-bar">
            <div
              className={`sp-progress-fill ${phase === 'complete' ? 'sp-progress-fill--done' : ''} ${phase === 'finalizing' && !scanData ? 'sp-progress-fill--waiting' : ''}`}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          <span className="sp-progress-pct">{Math.round(Math.min(overallProgress, 100))}%</span>
        </div>

        {/* File tree */}
        <div className="sp-tree-container">
          <div className="sp-tree-header">
            <span className="sp-tree-header-icon">📂</span>
            <span>Project Structure</span>
            <span className="sp-tree-header-count">{scannedFiles.size}/{totalFiles}</span>
          </div>
          <div className="sp-tree-scroll">
            {tree.map((node, idx) => (
              <TreeNode
                key={node.path || `root-${idx}`}
                node={node}
                depth={0}
                scannedFiles={scannedFiles}
                currentFile={currentFile}
                expandedFolders={expandedFolders}
              />
            ))}
          </div>
        </div>

        {/* Finalize waiting indicator */}
        {phase === 'finalizing' && !scanData && (
          <div className="sp-waiting-banner">
            <span className="sp-scan-spinner sp-scan-spinner--lg" />
            <div className="sp-waiting-text">
              <span className="sp-waiting-title">Processing results on server...</span>
              <span className="sp-waiting-sub">
                Checked {pollCount} time{pollCount !== 1 ? 's' : ''} • retrying every 10s
              </span>
            </div>
          </div>
        )}

        {/* Completion card */}
        {phase === 'complete' && (
          <div className="sp-complete-section">
            <div className="sp-complete-count">
              <span className="sp-count-number">{vulnCount}</span>
              <span className="sp-count-label">vulnerabilities detected</span>
            </div>
            <div className="sp-severity-row">
              {totalErrors > 0 && (
                <span className="sp-sev sp-sev--error">🔴 {totalErrors} Error{totalErrors > 1 ? 's' : ''}</span>
              )}
              {totalWarnings > 0 && (
                <span className="sp-sev sp-sev--warning">🟡 {totalWarnings} Warning{totalWarnings > 1 ? 's' : ''}</span>
              )}
              {totalErrors === 0 && totalWarnings === 0 && (
                <span className="sp-sev sp-sev--success">✅ No issues found</span>
              )}
            </div>
            {scanTime && (
              <p className="sp-total-time">
                Backend scan completed in {scanTime.toFixed(2)}s
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanProgress;
