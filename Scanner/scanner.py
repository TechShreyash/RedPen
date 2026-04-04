# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "semgrep",
#     "requests",
# ]
# ///

import json
import sys
import os
import subprocess
import requests

# ── Configuration ───────────────────────────────────────────────────────────
API_BASE = "http://127.0.0.1:8000"
API_INIT = f"{API_BASE}/api/scans/files"
API_RESULTS = f"{API_BASE}/api/scans/results"
WEB_BASE = "https://redpen.com"


# ── Directory structure ─────────────────────────────────────────────────────

def get_directory_structure(path="."):
    """Walk the directory and return a list of relative file paths."""
    file_list = []
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "__pycache__", ".git", "venv", ".venv")]
        for f in files:
            if not f.startswith("."):
                rel = os.path.relpath(os.path.join(root, f), path)
                file_list.append(rel)
    return file_list


def send_directory_structure(file_list):
    """POST directory structure to API 1, returns scan ID."""
    try:
        response = requests.post(API_INIT, json={"files": file_list}, timeout=30)
        response.raise_for_status()
        return response.json().get("scan_id")
    except Exception:
        return None


# ── Scanning ────────────────────────────────────────────────────────────────

def scan_folder(target_directory):
    """Runs the scanner on a target directory and returns parsed JSON results."""
    this_file = os.path.basename(__file__)
    command = [
        "semgrep", "scan",
        "--config", "auto",
        "--json",
        "--quiet",
        "--exclude", this_file,
        target_directory
    ]

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode >= 2:
            sys.exit(1)
        return json.loads(result.stdout)
    except (FileNotFoundError, json.JSONDecodeError):
        sys.exit(1)


def read_source_lines(path: str) -> list:
    """Read all lines from a source file."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.readlines()


def determine_snippet_range(result: dict) -> tuple:
    """Determine the widest line range of the finding (including metavars)."""
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
    """Expand the range to cover a full syntactic block."""
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
    """Extract code snippet and extended context around it."""
    total = len(source_lines)
    s = max(1, start)
    e = min(total, end)

    snippet = "".join(source_lines[s - 1 : e])

    ext_s = max(1, s - context)
    ext_e = min(total, e + context)
    snippet_extended = "".join(source_lines[ext_s - 1 : ext_e])

    return snippet, snippet_extended, s, e, ext_s, ext_e


def process_result(result: dict, base_dir: str) -> dict:
    """Transform one raw result into the UI-friendly format."""
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


def process_scan():
    """Scan current directory and produce cleaned JSON."""
    raw = scan_folder(".")

    findings = raw.get("results", [])
    processed = [process_result(r, ".") for r in findings]

    paths_scanned = raw.get("paths", {}).get("scanned", [])
    total_time = raw.get("time", {}).get("profiling_times", {}).get("total_time", 0)

    return {
        "results": processed,
        "paths_scanned": paths_scanned,
        "total_time": total_time,
    }


# ── Upload results ──────────────────────────────────────────────────────────

def upload_scan_results(scan_id, results):
    """POST processed scan results to API 2."""
    try:
        payload={"scan_id": scan_id,"results":results}
        response = requests.post(API_RESULTS, json=payload, timeout=30)
        response.raise_for_status()
        return True
    except Exception:
        return False


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print("⚡ Initializing...")

    # Step 1: Collect directory structure → send to API 1 → get scan ID
    print("📂 Checking file directory structure...")
    file_list = get_directory_structure(".")
    scan_id = send_directory_structure(file_list)

    # Step 2: Print results URL
    if scan_id:
        print(f"🔗 Open webpage to check results: {WEB_BASE}/{scan_id}")
    else:
        print("🔗 Open webpage to check results: (offline mode — API unavailable)")

    # Step 3: Scan for vulnerabilities → upload to API 2
    print("🔍 Scanning for vulnerabilities...")
    results = process_scan()

    # print (results)

    if scan_id:
        upload_scan_results(scan_id, results)

    print("✅ Done")


if __name__ == "__main__":
    main()
