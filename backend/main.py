import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import file_structures_col, scan_results_col

app = FastAPI(title="RedPen Security Scanner API")

# CORS — permissive for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ──────────────────────────────────────────────

class FileStructureRequest(BaseModel):
    files: list[str]  # e.g. ['cmds.txt', 'scanner.py', 'scan.sh', ...]


class ScanResultsRequest(BaseModel):
    scan_id: str
    results: dict  # the full scanned JSON response


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

    # Upsert so re-submitting the same scan_id just overwrites
    await scan_results_col.update_one(
        {"scan_id": payload.scan_id},
        {
            "$set": {
                "scan_id": payload.scan_id,
                "results": payload.results,
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


# ── Run ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
