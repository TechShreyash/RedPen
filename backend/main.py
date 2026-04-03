import sys
import os
import uuid
import json
import subprocess
import shutil
import time
import tempfile
import zipfile

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RedPen Security Scanner API")

# CORS — permissive for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory results store: { scan_id: { results, paths_scanned, total_time, created_at } }
scan_results_store: dict = {}

# Max upload size: 50MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

# Frontend URL (used to generate the result URL shown to CLI users)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


# ─── Semgrep Helpers ────────────────────────────────────────────────────────────

def _find_semgrep():
    """Find the semgrep executable."""
    path = shutil.which("semgrep")
    if path:
        return [path]

    import glob
    patterns = [
        os.path.expanduser("~\\AppData\\Local\\Programs\\Python\\*\\Scripts\\semgrep.exe"),
        os.path.expanduser("~\\AppData\\Local\\Programs\\Python\\*\\Scripts\\semgrep.EXE"),
        os.path.expanduser("~/.local/bin/semgrep"),
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            return [matches[0]]

    return [sys.executable, "-m", "semgrep"]


def run_semgrep_scan(target_directory: str) -> dict:
    """Runs Semgrep on a target directory and returns parsed JSON results."""
    semgrep_cmd = _find_semgrep()
    command = semgrep_cmd + [
        "scan",
        "--config", "auto",
        "--json",
        "--quiet",
        target_directory,
    ]

    # Fix Windows encoding issues with semgrep (charmap codec errors)
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        result = subprocess.run(
            command, capture_output=True, text=True, check=False,
            timeout=300, env=env, encoding="utf-8", errors="replace"
        )

        if result.returncode >= 2:
            raise RuntimeError(f"Semgrep failed (exit code {result.returncode}): {result.stderr[:1000]}")

        scan_data = json.loads(result.stdout)
        return scan_data

    except subprocess.TimeoutExpired:
        raise RuntimeError("Semgrep scan timed out after 5 minutes.")
    except FileNotFoundError:
        raise RuntimeError("Semgrep is not installed. Install with: pip install semgrep")
    except json.JSONDecodeError:
        raise RuntimeError(f"Failed to parse Semgrep output. stderr: {result.stderr[:500]}")


# ─── Result Processing (inlined from process_results.py) ────────────────────────

def read_source_lines(path: str) -> list:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.readlines()


def determine_snippet_range(result: dict) -> tuple:
    start_line = result["start"]["line"]
    end_line = result["end"]["line"]

    metavars = result.get("extra", {}).get("metavars", {})
    for _name, mv in metavars.items():
        mv_start = mv.get("start", {}).get("line", start_line)
        mv_end = mv.get("end", {}).get("line", end_line)
        start_line = min(start_line, mv_start)
        end_line = max(end_line, mv_end)

        pv = mv.get("propagated_value", {})
        if pv:
            pv_start = pv.get("svalue_start", {}).get("line", start_line)
            pv_end = pv.get("svalue_end", {}).get("line", end_line)
            start_line = min(start_line, pv_start)
            end_line = max(end_line, pv_end)

    dt = result.get("extra", {}).get("dataflow_trace", {})
    for key in ("taint_source", "taint_sink"):
        trace = dt.get(key, [])
        if isinstance(trace, list) and len(trace) >= 2:
            loc = trace[1]
            if isinstance(loc, list) and len(loc) >= 1 and isinstance(loc[0], dict):
                t_start = loc[0].get("start", {}).get("line", start_line)
                t_end = loc[0].get("end", {}).get("line", end_line)
                start_line = min(start_line, t_start)
                end_line = max(end_line, t_end)

    return start_line, end_line


def expand_to_block(lines: list, start: int, end: int) -> tuple:
    total = len(lines)
    while start > 1:
        prev = lines[start - 2]
        stripped = prev.rstrip()
        if not stripped:
            break
        curr_indent = len(lines[start - 1]) - len(lines[start - 1].lstrip())
        prev_indent = len(prev) - len(prev.lstrip())
        if prev_indent < curr_indent or stripped.endswith(("(", ",")):
            start -= 1
        else:
            break

    while end < total:
        nxt = lines[end]
        stripped = nxt.rstrip()
        if not stripped:
            break
        curr_indent = len(lines[end - 1]) - len(lines[end - 1].lstrip())
        nxt_indent = len(nxt) - len(nxt.lstrip())
        if nxt_indent >= curr_indent or stripped.endswith((",", ")")):
            end += 1
        else:
            if ")" in stripped:
                end += 1
            break

    return start, end


def extract_snippets(source_lines: list, start: int, end: int, context: int = 10):
    total = len(source_lines)
    s = max(1, start)
    e = min(total, end)
    snippet = "".join(source_lines[s - 1: e])
    ext_s = max(1, s - context)
    ext_e = min(total, e + context)
    snippet_extended = "".join(source_lines[ext_s - 1: ext_e])
    return snippet, snippet_extended, s, e, ext_s, ext_e


def process_result(result: dict, base_dir: str) -> dict:
    path = result["path"]
    abs_path = os.path.join(base_dir, path)

    source_lines = []
    if os.path.isfile(abs_path):
        source_lines = read_source_lines(abs_path)

    raw_start, raw_end = determine_snippet_range(result)
    if source_lines:
        block_start, block_end = expand_to_block(source_lines, raw_start, raw_end)
    else:
        block_start, block_end = raw_start, raw_end

    snippet, snippet_extended, s, e, ext_s, ext_e = extract_snippets(
        source_lines, block_start, block_end, context=10
    )

    meta = result.get("extra", {}).get("metadata", {})
    metadata_clean = {
        "cwe": meta.get("cwe", []),
        "owasp": meta.get("owasp", []),
        "category": meta.get("category", ""),
        "technology": meta.get("technology", []),
        "references": meta.get("references", []),
        "likelihood": meta.get("likelihood", ""),
        "impact": meta.get("impact", ""),
        "confidence": meta.get("confidence", ""),
    }

    return {
        "check_id": result.get("check_id", ""),
        "path": path,
        "message": result.get("extra", {}).get("message", ""),
        "severity": result.get("extra", {}).get("severity", ""),
        "snippet": snippet,
        "snippet_lines": {"start": s, "end": e},
        "snippet_extended": snippet_extended,
        "snippet_extended_lines": {"start": ext_s, "end": ext_e},
        "metadata": metadata_clean,
    }


# ─── API Endpoints ──────────────────────────────────────────────────────────────

@app.post("/api/scan")
async def run_scan(file: UploadFile = File(...)):
    """
    Accepts a .zip file upload of a project folder.
    Extracts it, runs semgrep, stores results, returns a UUID + URL.
    """
    # Validate file type
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted.")

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    # Create temp directory and extract
    temp_dir = tempfile.mkdtemp(prefix="redpen_scan_")
    zip_path = os.path.join(temp_dir, "upload.zip")

    try:
        # Save and extract zip
        with open(zip_path, "wb") as f:
            f.write(contents)

        extract_dir = os.path.join(temp_dir, "project")
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

        # Run semgrep scan
        start_time = time.time()
        original_cwd = os.getcwd()

        try:
            os.chdir(extract_dir)
            raw = run_semgrep_scan(".")
        finally:
            os.chdir(original_cwd)

        elapsed = time.time() - start_time

        # Process results
        findings = raw.get("results", [])
        processed = [process_result(r, extract_dir) for r in findings]

        paths_scanned = raw.get("paths", {}).get("scanned", [])
        total_time = raw.get("time", {}).get("profiling_times", {}).get("total_time", 0)
        if total_time == 0:
            total_time = round(elapsed, 2)

        # Generate unique ID and store results
        scan_id = str(uuid.uuid4())[:8]
        scan_results_store[scan_id] = {
            "results": processed,
            "paths_scanned": paths_scanned,
            "total_time": total_time,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "findings_count": len(processed),
        }

        result_url = f"{FRONTEND_URL}/scan/{scan_id}"

        return {
            "id": scan_id,
            "url": result_url,
            "findings_count": len(processed),
        }

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan error: {str(e)}")
    finally:
        # Cleanup temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.get("/api/results/{scan_id}")
def get_results(scan_id: str):
    """Retrieve scan results by ID."""
    if scan_id not in scan_results_store:
        raise HTTPException(status_code=404, detail="Scan not found. It may have expired or the ID is invalid.")

    return scan_results_store[scan_id]


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "RedPen Scanner", "active_scans": len(scan_results_store)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
