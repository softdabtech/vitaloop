#!/usr/bin/env bash
# Server disk cleanup script for vitaloop production server.
# Run as root on 159.65.252.227 to free disk space.
# Safe to run while the app is running — does not touch live app files.

set -euo pipefail

echo "=== Disk usage BEFORE ==="
df -h /

echo ""
echo "--- Cleaning apt cache ---"
apt-get clean -y
apt-get autoremove -y

echo ""
echo "--- Cleaning Docker (if running) ---"
if command -v docker &>/dev/null; then
    docker system prune -f --volumes 2>/dev/null || true
    docker image prune -af 2>/dev/null || true
fi

echo ""
echo "--- Cleaning Python __pycache__ and .pyc files ---"
find /var/www/VITALOOP -name "__pycache__" -type d | xargs rm -rf 2>/dev/null || true
find /var/www/VITALOOP -name "*.pyc" | xargs rm -f 2>/dev/null || true
find /var/www/VITALOOP -name "*.pyo" | xargs rm -f 2>/dev/null || true

echo ""
echo "--- Cleaning old journal logs (keep 100M) ---"
journalctl --vacuum-size=100M

echo ""
echo "--- Cleaning old log files older than 30 days ---"
find /var/log -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
find /var/log -name "*.gz" -mtime +30 -delete 2>/dev/null || true

echo ""
echo "--- Cleaning tmp ---"
find /tmp -mtime +3 -delete 2>/dev/null || true

echo ""
echo "--- Checking backend .venv size ---"
du -sh /var/www/VITALOOP/backend/.venv 2>/dev/null || echo "No .venv found"

echo ""
echo "--- Top 15 largest directories under /var/www ---"
du -sh /var/www/VITALOOP/* 2>/dev/null | sort -rh | head -15

echo ""
echo "=== Disk usage AFTER ==="
df -h /
