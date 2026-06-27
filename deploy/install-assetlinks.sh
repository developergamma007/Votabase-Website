#!/usr/bin/env bash
# Install Digital Asset Links at the domain root for Play Store TWA.
# Run on the server: bash deploy/install-assetlinks.sh

set -euo pipefail

REPO="${HOME}/Votabase-Website"
SOURCE="${REPO}/deploy/assetlinks.json"
TARGET_DIR="/var/www/votabase-well-known/.well-known"
TARGET_FILE="${TARGET_DIR}/assetlinks.json"
SNIPPET="/etc/nginx/snippets/votabase-assetlinks.conf"
NGINX_SITE="/etc/nginx/sites-available/default"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing ${SOURCE}. Run: cd ${REPO} && git pull"
  exit 1
fi

echo "Installing assetlinks.json..."
sudo mkdir -p "$TARGET_DIR"
sudo cp "$SOURCE" "$TARGET_FILE"
sudo chmod 644 "$TARGET_FILE"

echo "Writing nginx snippet ${SNIPPET}..."
sudo mkdir -p /etc/nginx/snippets
sudo tee "$SNIPPET" > /dev/null <<'EOF'
location = /.well-known/assetlinks.json {
    alias /var/www/votabase-well-known/.well-known/assetlinks.json;
    default_type application/json;
    add_header Access-Control-Allow-Origin *;
}
EOF

# Remove a bad append from an older version of this script (location block outside server {}).
if grep -q 'Votabase Play Store TWA — Digital Asset Links' "$NGINX_SITE" 2>/dev/null; then
  echo "Removing previously appended nginx block from ${NGINX_SITE}..."
  sudo cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d%H%M%S)"
  sudo python3 - <<'PY'
from pathlib import Path
path = Path("/etc/nginx/sites-available/default")
text = path.read_text()
start = text.find("# Votabase Play Store TWA — Digital Asset Links")
if start != -1:
    path.write_text(text[:start].rstrip() + "\n")
    print("Removed trailing block outside server {}.")
PY
fi

INCLUDE='include /etc/nginx/snippets/votabase-assetlinks.conf;'

if grep -q 'snippets/votabase-assetlinks.conf' "$NGINX_SITE" 2>/dev/null; then
  echo "Nginx site already includes ${SNIPPET}"
else
  echo "Adding include to server block in ${NGINX_SITE}..."
  sudo cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d%H%M%S)"
  sudo python3 - <<PY
from pathlib import Path

site = Path("${NGINX_SITE}")
include_line = "    ${INCLUDE}\n"
text = site.read_text()

if include_line.strip() in text:
    raise SystemExit(0)

markers = ["votabase.iswot.in", "server_name"]
insert_at = None
server_name_idx = text.find("votabase.iswot.in")
if server_name_idx == -1:
    # Fallback: first server block
    server_name_idx = text.find("server {")

if server_name_idx == -1:
    raise SystemExit("Could not find a server block in ${NGINX_SITE}. Add this line manually inside server {}:\n    ${INCLUDE}")

block_start = text.rfind("server {", 0, server_name_idx)
if block_start == -1:
    block_start = text.find("server {")

block_end = text.find("\n}", block_start)
if block_end == -1:
    raise SystemExit("Could not find end of server block.")

block = text[block_start:block_end]
location_idx = block.find("location ")
if location_idx == -1:
    raise SystemExit("Could not find a location block inside server {}. Add manually:\n    ${INCLUDE}")

insert_at = block_start + location_idx
new_text = text[:insert_at] + include_line + text[insert_at:]
site.write_text(new_text)
print("Inserted include before first location in server block.")
PY
fi

echo "Testing nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo
echo "Verify (must show JSON, not HTML 404):"
curl -s "https://votabase.iswot.in/.well-known/assetlinks.json" | head -c 220
echo
