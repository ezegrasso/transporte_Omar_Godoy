#!/usr/bin/env bash
# Simple backup using mysqldump. Configure env vars DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR="./backups"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/${DB_NAME:-transporte}_${TIMESTAMP}.sql.gz"

if [ -z "${DB_HOST+x}" ]; then
  echo "DB_HOST not set" >&2
  exit 1
fi

echo "Starting mysqldump to $OUT_FILE"
mysqldump -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "${DB_USER:-root}" -p"${DB_PASSWORD:-}" "${DB_NAME:-transporte_omar_godoy}" | gzip > "$OUT_FILE"

echo "Backup written to $OUT_FILE"

# Optional: upload to Google Cloud Storage if CLOUD_STORAGE_BUCKET and gsutil installed
if [ ! -z "${CLOUD_STORAGE_BUCKET:-}" ]; then
  if command -v gsutil >/dev/null 2>&1; then
    echo "Uploading to gs://$CLOUD_STORAGE_BUCKET/"$(basename "$OUT_FILE")
    gsutil cp "$OUT_FILE" "gs://$CLOUD_STORAGE_BUCKET/"
  else
    echo "gsutil not found, skipping upload" >&2
  fi
fi
