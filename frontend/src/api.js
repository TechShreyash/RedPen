/**
 * RedPen API Service
 * Centralised API calls to the deployed FastAPI backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://redpen-api.tashanwin.buzz/api';

// ── File structure ────────────────────────────────────────────
/**
 * POST /api/scans/files
 * Send the list of scanned file paths and receive a scan_id.
 */
export async function saveFileStructure(files) {
  const res = await fetch(`${API_BASE}/scans/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(`Failed to save file structure (${res.status})`);
  return res.json(); // { scan_id }
}

/**
 * GET /api/scans/files/:scanId
 * Retrieve the file structure for a given scan.
 */
export async function getFileStructure(scanId) {
  const res = await fetch(`${API_BASE}/scans/files/${scanId}`);
  if (!res.ok) throw new Error(`File structure not found (${res.status})`);
  return res.json();
}

// ── Scan results ──────────────────────────────────────────────
/**
 * GET /api/scans/results/:scanId
 * Retrieve the full scan results for a given scan.
 * Returns null (instead of throwing) when results aren't ready yet (404).
 */
export async function getScanResults(scanId) {
  const res = await fetch(`${API_BASE}/scans/results/${scanId}`);
  if (!res.ok) return null; // not ready yet — API returns error while scan is running
  return res.json();
}

/**
 * POST /api/scans/results
 * Save / update scan results for an existing scan_id.
 */
export async function saveScanResults(scanId, results) {
  const res = await fetch(`${API_BASE}/scans/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scan_id: scanId, results }),
  });
  if (!res.ok) throw new Error(`Failed to save scan results (${res.status})`);
  return res.json();
}

/**
 * Poll for scan results every `intervalMs` until results arrive or `timeoutMs` is exceeded.
 * @param {string} scanId
 * @param {(data: object | null) => void} onPoll  – called after every poll attempt
 * @param {{ intervalMs?: number, timeoutMs?: number }} opts
 * @returns {{ promise: Promise<object>, cancel: () => void }}
 */
export function pollScanResults(scanId, onPoll, { intervalMs = 5000, timeoutMs = 300000 } = {}) {
  let cancelled = false;
  let timerId = null;

  const promise = new Promise((resolve, reject) => {
    const start = Date.now();

    const tick = async () => {
      if (cancelled) return;

      try {
        const data = await getScanResults(scanId);
        onPoll?.(data);

        if (data) {
          // Results are ready
          resolve(data);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        reject(err);
        return;
      }

      if (Date.now() - start > timeoutMs) {
        reject(new Error('Scan timed out'));
        return;
      }

      timerId = setTimeout(tick, intervalMs);
    };

    tick();
  });

  const cancel = () => {
    cancelled = true;
    if (timerId) clearTimeout(timerId);
  };

  return { promise, cancel };
}

// ── AI Remediation ────────────────────────────────────────────────
/**
 * POST /api/scans/remediate
 * Send a vulnerability finding and receive an AI-generated fix suggestion.
 */
export async function remediateFinding(finding) {
  const res = await fetch(`https://redpen-api.tashanwin.buzz/scans/remediate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finding),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Remediation failed (${res.status})`);
  }
  return res.json();
}
