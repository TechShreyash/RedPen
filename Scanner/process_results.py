import json
import sys
import os
import subprocess

def scan_folder_with_semgrep(target_directory):
    """
    Runs Semgrep on a target directory and returns the parsed JSON results.
    """
    print(f"Starting Semgrep scan on: {target_directory}...")
    
    # Exclude this script itself from being scanned
    this_file = os.path.basename(__file__)

    # We use --json to get structured output and --quiet to suppress standard logs
    command = [
        "semgrep", "scan", 
        "--config", "auto", 
        "--json", 
        "--quiet",
        "--exclude", this_file,
        target_directory
    ]
    
    try:
        # Run the command and capture the output
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        
        # Semgrep returns exit code 1 if it finds issues, and 0 if it finds none.
        # Exit code 2+ usually means a crash or configuration error.
        if result.returncode >= 2:
            print(f"Semgrep failed to run. Error: {result.stderr}")
            sys.exit(1)
            
        # Parse the JSON output
        scan_data = json.loads(result.stdout)
        return scan_data

    except FileNotFoundError:
        print("Semgrep is not installed or not in your system PATH.")
        sys.exit(1)
    except json.JSONDecodeError:
        print("Failed to parse Semgrep JSON output.")
        sys.exit(1)

def read_source_lines(path: str) -> list[str]:
    """Read all lines from a source file. Returns list of lines WITH newlines."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.readlines()


def determine_snippet_range(result: dict) -> tuple[int, int]:
    """
    Determine the full line range of the code construct that triggered
    the finding. This inspects metavar positions + start/end of the
    result itself and returns the widest (min_line, max_line).
    """
    start_line = result["start"]["line"]
    end_line = result["end"]["line"]

    # Also look at metavar positions — they often span a broader construct
    metavars = result.get("extra", {}).get("metavars", {})
    for _name, mv in metavars.items():
        mv_start = mv.get("start", {}).get("line", start_line)
        mv_end = mv.get("end", {}).get("line", end_line)
        start_line = min(start_line, mv_start)
        end_line = max(end_line, mv_end)

        # propagated_value can point even further
        pv = mv.get("propagated_value", {})
        if pv:
            pv_start = pv.get("svalue_start", {}).get("line", start_line)
            pv_end = pv.get("svalue_end", {}).get("line", end_line)
            start_line = min(start_line, pv_start)
            end_line = max(end_line, pv_end)

    # Also check dataflow_trace for taint_source / taint_sink ranges
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


def expand_to_block(lines: list[str], start: int, end: int) -> tuple[int, int]:
    """
    Try to expand the range to cover a full syntactic block.
    Walks outward from start/end while the indentation suggests we're
    inside a multi-line call or block (simple heuristic: look for
    matching parens / lower indentation).
    """
    total = len(lines)

    # Walk upward while line is continuation (higher indent or opens a block)
    while start > 1:
        prev = lines[start - 2]  # 0-indexed
        stripped = prev.rstrip()
        if not stripped:
            break
        # If previous line ends with '(' or ',' or has deeper/equal indent
        curr_indent = len(lines[start - 1]) - len(lines[start - 1].lstrip())
        prev_indent = len(prev) - len(prev.lstrip())
        if prev_indent < curr_indent or stripped.endswith(("(", ",")):
            start -= 1
        else:
            break

    # Walk downward to close the block (look for closing paren at lower indent)
    while end < total:
        nxt = lines[end]  # 0-indexed (end is 1-indexed, so lines[end] is end+1)
        stripped = nxt.rstrip()
        if not stripped:
            break
        curr_indent = len(lines[end - 1]) - len(lines[end - 1].lstrip())
        nxt_indent = len(nxt) - len(nxt.lstrip())
        if nxt_indent >= curr_indent or stripped.endswith((",", ")")):
            end += 1
        else:
            # Include closing paren line
            if ")" in stripped:
                end += 1
            break

    return start, end


def extract_snippets(source_lines: list[str], start: int, end: int, context: int = 10):
    """
    Given 1-indexed start/end line numbers:
      - snippet:          lines[start-1 .. end-1]
      - snippet_extended: lines[start-1-context .. end-1+context] (clamped)
    Returns (snippet, snippet_extended, ext_start, ext_end)
    """
    total = len(source_lines)

    # Clamp
    s = max(1, start)
    e = min(total, end)

    snippet = "".join(source_lines[s - 1 : e])

    ext_s = max(1, s - context)
    ext_e = min(total, e + context)
    snippet_extended = "".join(source_lines[ext_s - 1 : ext_e])

    return snippet, snippet_extended, s, e, ext_s, ext_e


def process_result(result: dict, base_dir: str) -> dict:
    """Transform one raw semgrep result into the UI-friendly format."""
    path = result["path"]
    abs_path = os.path.join(base_dir, path)

    # Read source file
    source_lines = []
    if os.path.isfile(abs_path):
        source_lines = read_source_lines(abs_path)

    # Determine the range of the vulnerable code construct
    raw_start, raw_end = determine_snippet_range(result)

    # Try to expand to a full block (e.g. the whole add_middleware call)
    if source_lines:
        block_start, block_end = expand_to_block(source_lines, raw_start, raw_end)
    else:
        block_start, block_end = raw_start, raw_end

    snippet, snippet_extended, s, e, ext_s, ext_e = extract_snippets(
        source_lines, block_start, block_end, context=10
    )

    # Extract metadata subset
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


def process_semgrep_json():
    """Main entry: scan current directory with semgrep, produce cleaned JSON."""
    raw = scan_folder_with_semgrep(".")

    findings = raw.get("results", [])
    base_dir = "."
    processed = [process_result(r, base_dir) for r in findings]

    # Top-level fields
    paths_scanned = raw.get("paths", {}).get("scanned", [])
    total_time = raw.get("time", {}).get("profiling_times", {}).get("total_time", 0)

    output = {
        "results": processed,
        "paths_scanned": paths_scanned,
        "total_time": total_time,
    }

    return output


if __name__ == "__main__":
    print(json.dumps(process_semgrep_json(), indent=2))
