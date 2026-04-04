/**
 * RedPen API Service
 * Centralised API calls to the FastAPI backend.
 *
 * In development the Vite proxy rewrites /api → http://localhost:8000/api
 * so we only need relative paths here.
 */

const API_BASE = '/api';

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
 */
export async function getScanResults(scanId) {
  const res = await fetch(`${API_BASE}/scans/results/${scanId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Scan results not found (${res.status})`);
  }
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
