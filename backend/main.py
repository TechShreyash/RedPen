import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import file_structures_col, scan_results_col
from gemini_summary import enrich_results_with_titles

load_dotenv()

app = FastAPI(title="RedPen Security Scanner API")

# CORS — locked to known origins in production
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://redpen.tashanwin.buzz,http://localhost:5173,http://localhost:4173"
)
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)


# ── Pydantic models ──────────────────────────────────────────────

class FileStructureRequest(BaseModel):
    files: list[str]  # e.g. ['cmds.txt', 'scanner.py', 'scan.sh', ...]


class ScanResultsRequest(BaseModel):
    scan_id: str
    results: dict  # the full scanned JSON response


class RemediateRequest(BaseModel):
    check_id: str
    path: str
    message: str
    severity: str
    snippet: str
    snippet_lines: dict  # { start, end }
    snippet_extended: Optional[str] = ""
    snippet_extended_lines: Optional[dict] = None
    metadata: Optional[dict] = None


@app.get("/")
async def root():
    return {"message": "Welcome to RedPen Security Scanner API"}


# ── Route 1: Save file structure → returns unique scan_id ─────────

@app.post("/api/scans/files")
async def save_file_structure(payload: FileStructureRequest):
    scan_id = uuid.uuid4().hex[:12]

    doc = {
        "scan_id": scan_id,
        "files": payload.files,
        "created_at": datetime.now(timezone.utc),
    }
    await file_structures_col.insert_one(doc)

    return {"scan_id": scan_id}


# ── Route 2: Get file structure by scan_id ────────────────────────

@app.get("/api/scans/files/{scan_id}")
async def get_file_structure(scan_id: str):
    doc = await file_structures_col.find_one(
        {"scan_id": scan_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")

    return doc


# ── Route 3: Save scan results using existing scan_id ─────────────

@app.post("/api/scans/results")
async def save_scan_results(payload: ScanResultsRequest):
    # Verify that the scan_id exists in file_structures
    exists = await file_structures_col.find_one({"scan_id": payload.scan_id})
    if not exists:
        raise HTTPException(
            status_code=404,
            detail=f"No scan found with id '{payload.scan_id}'. Save file structure first.",
        )

    # ── Enrich each result with a short AI-generated title (parallel) ──
    enriched_results = await enrich_results_with_titles(payload.results)

    # Upsert so re-submitting the same scan_id just overwrites
    await scan_results_col.update_one(
        {"scan_id": payload.scan_id},
        {
            "$set": {
                "scan_id": payload.scan_id,
                "results": enriched_results,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    return {"status": "saved", "scan_id": payload.scan_id}


# ── Route 4: Get scan results by scan_id ──────────────────────────

@app.get("/api/scans/results/{scan_id}")
async def get_scan_results(scan_id: str):
    doc = await scan_results_col.find_one(
        {"scan_id": scan_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Scan results not found")

    return doc


# ── Route 5: AI Remediation — generate fix suggestions ────────────

@app.post("/api/scans/remediate")
async def remediate_finding(payload: RemediateRequest):
    """
    Generate an AI-powered fix suggestion for a vulnerability finding.
    Uses Google Gemini (Gemma 3 27B) to analyze the vulnerability and
    produce a corrected code snippet.
    """
    # Get the first available Gemini API key
    api_key = None
    for i in range(1, 4):
        key = os.environ.get(f"GEMINI_API_KEY_{i}")
        if key and not key.startswith("your_"):
            api_key = key
            break

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="No Gemini API key configured. Add GEMINI_API_KEY_1 to your .env file.",
        )

    finding = payload.model_dump()

    meta = finding.get("metadata") or {}
    cwe_list = ", ".join(meta.get("cwe", []) or [])
    owasp_list = ", ".join(meta.get("owasp", []) or [])
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
        from google import genai
        import json

        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
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
        orig_lines = snippet.split("\n")
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

        result["diff"] = diff
        return result

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Failed to parse AI response as valid JSON.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Remediation failed: {str(e)}"
        )


# ── Run ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
