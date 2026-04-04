#!/usr/bin/env bash
# RedPen Scanner — One-line installer & runner
# Usage: curl -sSL https://raw.githubusercontent.com/TechShreyash/RedPen/main/Scanner/scan.sh | bash
set -euo pipefail

SCRIPT_URL="https://raw.githubusercontent.com/TechShreyash/RedPen/main/Scanner/scanner.py"

# ── Ensure uv is available (silent) ────────────────────────────────────────
if ! command -v uv &>/dev/null; then
	curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
	export PATH="$HOME/.local/bin:$PATH"
	command -v uv &>/dev/null || { echo "❌ Failed to install uv"; exit 1; }
fi

# ── Setup scanner credentials (temp file — user's config untouched) ────────
SCANNER_TMP_SETTINGS=$(mktemp /tmp/redpen_scanner_settings_XXXXXX.yml)
cat >"$SCANNER_TMP_SETTINGS" <<'EOF'
has_shown_metrics_notification: true
anonymous_user_id: 588dced2-fa8f-404f-b9a5-f94c25f47d43
api_token: 6a7c09e40a5c51bc682b38496fb22673a367a3fdf7ec1fc461143b815ac42b54
EOF
export SEMGREP_SETTINGS_FILE="$SCANNER_TMP_SETTINGS"

# ── Download & run scanner ─────────────────────────────────────────────────
TMPFILE=$(mktemp /tmp/redpen_scanner_XXXXXX.py)
trap 'rm -f "$TMPFILE" "$SCANNER_TMP_SETTINGS"' EXIT

curl -sSL "$SCRIPT_URL" -o "$TMPFILE"
uv run "$TMPFILE"
