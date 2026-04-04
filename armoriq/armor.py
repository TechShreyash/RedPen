"""
RedPen ArmorIQ — Python bridge for the Node.js remediation module.

This module provides a Python interface to call the ArmorIQ remediation
engine (which uses Groq LLM + ArmorIQ SDK under the hood).

Usage:
    from armor import generate_fix_suggestion

    fix = generate_fix_suggestion(finding_dict)
"""

import json
import subprocess
import os
import sys

ARMORIQ_DIR = os.path.dirname(os.path.abspath(__file__))


def generate_fix_suggestion(finding: dict) -> dict:
    """
    Call the Node.js remediation module to generate a fix for a single finding.

    Args:
        finding: A scan result finding dict with keys like check_id, path,
                 message, severity, snippet, snippet_lines, metadata, etc.

    Returns:
        dict with keys: fixed_code, explanation, security_note, diff, error
    """
    # Write the finding to a temp file for the Node.js script to read
    temp_input = os.path.join(ARMORIQ_DIR, ".tmp_finding.json")
    temp_output = os.path.join(ARMORIQ_DIR, ".tmp_fix.json")

    try:
        # Create a mini scan results wrapper
        scan_data = {"results": [finding]}
        with open(temp_input, "w", encoding="utf-8") as f:
            json.dump(scan_data, f)

        # Call the Node.js remediation script
        result = subprocess.run(
            ["node", "-e", f"""
import {{ generateFix }} from './remediate.js';
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('{temp_input.replace(os.sep, "/")}', 'utf-8'));
const finding = data.results[0];

try {{
    const fix = await generateFix(finding);
    fs.writeFileSync('{temp_output.replace(os.sep, "/")}', JSON.stringify(fix, null, 2));
}} catch (err) {{
    fs.writeFileSync('{temp_output.replace(os.sep, "/")}', JSON.stringify({{ error: err.message }}));
}}
"""],
            cwd=ARMORIQ_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )

        if os.path.exists(temp_output):
            with open(temp_output, "r", encoding="utf-8") as f:
                return json.load(f)

        return {"error": result.stderr or "Unknown error from Node.js remediation module"}

    except subprocess.TimeoutExpired:
        return {"error": "Remediation timed out (60s limit)"}
    except FileNotFoundError:
        return {"error": "Node.js not found — install Node.js to use AI remediation"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        # Cleanup temp files
        for f in [temp_input, temp_output]:
            if os.path.exists(f):
                os.remove(f)


def generate_fix_with_gemini(finding: dict, api_key: str) -> dict:
    """
    Generate a fix suggestion using Google Gemini directly from Python.
    This is an alternative to the Node.js/Groq path — used by the backend API.

    Args:
        finding: A scan result finding dict
        api_key: Google Gemini API key

    Returns:
        dict with keys: fixed_code, explanation, security_note, diff
    """
    try:
        from google import genai
    except ImportError:
        return {"error": "google-genai package not installed. Run: pip install google-genai"}

    cwe_list = ", ".join(finding.get("metadata", {}).get("cwe", []))
    owasp_list = ", ".join(finding.get("metadata", {}).get("owasp", []))
    snippet = finding.get("snippet", "")
    snippet_extended = finding.get("snippet_extended", snippet)
    snippet_lines = finding.get("snippet_lines", {})

    prompt = f"""You are an expert application security engineer. Fix this vulnerability.

Return ONLY a valid JSON object with keys: fixed_code, explanation, security_note.
- fixed_code: the corrected code (drop-in replacement for the vulnerable snippet)
- explanation: 2-3 sentence explanation of the fix
- security_note: one sentence about residual risk

Rule: {finding.get("check_id", "unknown")}
Severity: {finding.get("severity", "UNKNOWN")}
File: {finding.get("path", "unknown")}
Lines: {snippet_lines.get("start", "?")}-{snippet_lines.get("end", "?")}
CWE: {cwe_list or "N/A"}
OWASP: {owasp_list or "N/A"}

Vulnerability:
{finding.get("message", "")}

Vulnerable Code:
```
{snippet}
```

Context:
```
{snippet_extended}
```

Return ONLY the JSON object, no markdown fences."""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemma-3-27b-it",
            contents=prompt,
        )

        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        result = json.loads(text)

        # Build a simple diff
        fixed = result.get("fixed_code", "")
        diff = _build_diff(snippet, fixed, snippet_lines)
        result["diff"] = diff

        return result

    except json.JSONDecodeError:
        return {"error": "Failed to parse Gemini response as JSON", "raw": text[:500]}
    except Exception as e:
        return {"error": str(e)}


def _build_diff(original: str, fixed: str, snippet_lines: dict) -> str:
    """Build a simple unified diff string."""
    if not original or not fixed:
        return ""

    orig_lines = original.split("\n")
    fixed_lines = fixed.split("\n")
    start = snippet_lines.get("start", 1)

    diff = f"--- original\n+++ fixed\n@@ -{start},{len(orig_lines)} +{start},{len(fixed_lines)} @@\n"

    max_len = max(len(orig_lines), len(fixed_lines))
    for i in range(max_len):
        orig = orig_lines[i] if i < len(orig_lines) else None
        fix = fixed_lines[i] if i < len(fixed_lines) else None

        if orig == fix:
            if orig is not None:
                diff += f" {orig}\n"
        else:
            if orig is not None:
                diff += f"-{orig}\n"
            if fix is not None:
                diff += f"+{fix}\n"

    return diff


if __name__ == "__main__":
    # Quick test
    test_finding = {
        "check_id": "python.django.security.injection.sql.sql-injection-using-format-string",
        "path": "testApi/api.py",
        "message": "User input is concatenated into SQL query without parameterization.",
        "severity": "ERROR",
        "snippet": 'query = f"SELECT id, username FROM users WHERE username LIKE \'%{name}%\'"',
        "snippet_lines": {"start": 78, "end": 78},
        "snippet_extended": "",
        "metadata": {
            "cwe": ["CWE-89: SQL Injection"],
            "owasp": ["A03:2021 - Injection"],
        },
    }

    print("Testing Python bridge to Node.js remediation...")
    result = generate_fix_suggestion(test_finding)
    print(json.dumps(result, indent=2))