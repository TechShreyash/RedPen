#!/bin/bash
# ═══════════════════════════════════════════════════════
#  RedPen — Security Vulnerability Scanner
#  Usage: curl -sL <URL>/scan.sh | bash
#  Or:    bash scan.sh
# ═══════════════════════════════════════════════════════

set -e

# Configuration
REDPEN_API="${REDPEN_API:-http://localhost:8000}"
ZIP_FILE=$(mktemp /tmp/redpen_scan_XXXXXX.zip)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${RED}${BOLD}  ╔═══════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}  ║     🛡️  RedPen Scanner        ║${NC}"
echo -e "${RED}${BOLD}  ╚═══════════════════════════════╝${NC}"
echo ""

# Check if we're in a directory with files
if [ -z "$(ls -A .)" ]; then
    echo -e "${RED}Error: Current directory is empty.${NC}"
    exit 1
fi

echo -e "${CYAN}📁 Scanning directory:${NC} $(pwd)"
echo -e "${YELLOW}📦 Zipping project files...${NC}"

# Create zip, excluding common non-essential directories
zip -r "$ZIP_FILE" . \
    -x "node_modules/*" \
    -x ".git/*" \
    -x "__pycache__/*" \
    -x "*.pyc" \
    -x ".env" \
    -x ".venv/*" \
    -x "venv/*" \
    -x "dist/*" \
    -x "build/*" \
    -x ".next/*" \
    -x "*.zip" \
    -x ".DS_Store" \
    -q 2>/dev/null

ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo -e "${GREEN}✓ Created archive (${ZIP_SIZE})${NC}"

echo -e "${YELLOW}🚀 Uploading to RedPen...${NC}"

# Upload and capture response
RESPONSE=$(curl -s -X POST "${REDPEN_API}/api/scan" \
    -F "file=@${ZIP_FILE}" \
    -H "Accept: application/json" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

# Cleanup
rm -f "$ZIP_FILE"

# Check response
if [ "$HTTP_CODE" -ne 200 ]; then
    echo -e "${RED}✗ Scan failed (HTTP ${HTTP_CODE})${NC}"
    echo -e "${RED}  ${BODY}${NC}"
    exit 1
fi

# Parse response
SCAN_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
SCAN_URL=$(echo "$BODY" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
FINDINGS=$(echo "$BODY" | grep -o '"findings_count":[0-9]*' | cut -d':' -f2)

echo ""
echo -e "${GREEN}${BOLD}✓ Scan complete!${NC}"
echo -e "${CYAN}  Findings: ${BOLD}${FINDINGS}${NC}"
echo ""
echo -e "${BOLD}  🔗 View your results:${NC}"
echo -e "${GREEN}${BOLD}  ${SCAN_URL}${NC}"
echo ""
