#!/usr/bin/env bash
# Install Digital Asset Links at the domain root for Play Store TWA.
# Run on the server: bash deploy/install-assetlinks.sh

set -euo pipefail

REPO="${HOME}/Votabase-Website"
SOURCE="${REPO}/deploy/assetlinks.json"
TARGET_DIR="/var/www/votabase-well-known/.well-known"
TARGET_FILE="${TARGET_DIR}/assetlinks.json"
SNIPPET_FILE="${REPO}/deploy/nginx-assetlinks.conf"
NGINX_SITE="/etc/nginx/sites-available/default"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing ${SOURCE}. Run: cd ${REPO} && git pull"
  exit 1
fi

echo "Installing assetlinks.json..."
sudo mkdir -p "$TARGET_DIR"
sudo cp "$SOURCE" "$TARGET_FILE"
sudo chmod 644 "$TARGET_FILE"

if grep -q 'assetlinks.json' "$NGINX_SITE" 2>/dev/null; then
  echo "Nginx already has assetlinks block in ${NGINX_SITE}"
else
  echo "Adding nginx location block to ${NGINX_SITE}..."
  sudo cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d%H%M%S)"
  sudo tee -a "$NGINX_SITE" > /dev/null <<'EOF'

    # Votabase Play Store TWA — Digital Asset Links (domain root)
    location = /.well-known/assetlinks.json {
        alias /var/www/votabase-well-known/.well-known/assetlinks.json;
        default_type application/json;
        add_header Access-Control-Allow-Origin *;
    }
EOF
fi

echo "Testing nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo
echo "Verify:"
curl -s "https://votabase.iswot.in/.well-known/assetlinks.json" | head -c 200
echo
