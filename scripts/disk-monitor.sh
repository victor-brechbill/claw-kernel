#!/bin/bash
# Disk space monitor - runs every 5 minutes via cron
# 80%: Log warning
# 90%: Shutdown gateway gracefully to prevent 100% disk hang

DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
LOG_FILE="$HOME/clawd/logs/disk-monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$(dirname "$LOG_FILE")"

if [ "$DISK_USAGE" -ge 90 ]; then
  echo "[$TIMESTAMP] 🚨 CRITICAL: Disk at ${DISK_USAGE}% - Shutting down gateway to prevent 100% hang" >> "$LOG_FILE"
  
  # Shutdown gateway gracefully
  systemctl --user stop openclaw-gateway.service
  
  # Try to send alert (if possible - disk might be too full for HTTP request)
  curl -X POST http://localhost:18789/api/message/send \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚨 EMERGENCY: Disk at ${DISK_USAGE}%. Gateway shut down to prevent system hang. Free space and run: systemctl --user start openclaw-gateway.service\"}" \
    2>/dev/null || true
    
elif [ "$DISK_USAGE" -ge 80 ]; then
  echo "[$TIMESTAMP] ⚠️  WARNING: Disk at ${DISK_USAGE}% - cleanup recommended" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ✓ OK: Disk at ${DISK_USAGE}%" >> "$LOG_FILE"
fi
