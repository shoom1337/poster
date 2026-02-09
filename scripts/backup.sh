#!/bin/bash

# PostgreSQL backup script
# Runs daily at 3:00 AM via cron

set -e

# Configuration
BACKUP_DIR="/backups"
DB_NAME="poster_db"
DB_USER="poster_user"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/poster_db_$TIMESTAMP.sql.gz"

echo "[$(date)] Starting database backup..."

# Perform backup
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  -Fc \
  | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup completed successfully: $BACKUP_FILE"

  # Get backup size
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup size: $SIZE"

  # Clean up old backups (keep only last 7 days)
  echo "[$(date)] Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
  find "$BACKUP_DIR" -name "poster_db_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

  # List remaining backups
  echo "[$(date)] Current backups:"
  ls -lh "$BACKUP_DIR"/poster_db_*.sql.gz
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi
