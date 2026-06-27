# Fix nginx after a failed install (location block outside server {})
#
# Run on server:
#   bash deploy/fix-nginx-assetlinks.sh

set -euo pipefail

NGINX_SITE="/etc/nginx/sites-available/default"
SNIPPET="/etc/nginx/snippets/votabase-assetlinks.conf"

echo "Step 1: Restore nginx config from latest backup (if broken)..."
LATEST_BACKUP="$(ls -t ${NGINX_SITE}.bak.* 2>/dev/null | head -1 || true)"
if [[ -n "$LATEST_BACKUP" ]]; then
  echo "Restoring: $LATEST_BACKUP"
  sudo cp "$LATEST_BACKUP" "$NGINX_SITE"
else
  echo "No backup found — removing bad trailing block only..."
  if grep -q 'Votabase Play Store TWA' "$NGINX_SITE"; then
    sudo python3 - <<'PY'
from pathlib import Path
path = Path("/etc/nginx/sites-available/default")
text = path.read_text()
start = text.find("# Votabase Play Store TWA")
if start != -1:
    path.write_text(text[:start].rstrip() + "\n")
PY
  fi
fi

echo "Step 2: Install assetlinks file + snippet..."
bash "$(dirname "$0")/install-assetlinks.sh"
