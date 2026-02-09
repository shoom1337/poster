#!/bin/bash

# PostgreSQL restore script

set -e

# Configuration
BACKUP_DIR="/backups"
DB_NAME="poster_db"
DB_USER="poster_user"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Available backups:"
  ls -lh "$BACKUP_DIR"/poster_db_*.sql.gz
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] Starting database restore..."
echo "[$(date)] Backup file: $BACKUP_FILE"

# Confirm restore
read -p "This will DROP and recreate the database. Are you sure? (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

# Drop and recreate database
echo "[$(date)] Dropping database..."
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "[$(date)] Creating database..."
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d postgres \
  -c "CREATE DATABASE $DB_NAME;"

# Restore backup
echo "[$(date)] Restoring backup..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl

if [ $? -eq 0 ]; then
  echo "[$(date)] Restore completed successfully!"
else
  echo "[$(date)] ERROR: Restore failed!"
  exit 1
fi
