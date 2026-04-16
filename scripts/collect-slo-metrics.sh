#!/bin/bash
# SLO Dashboard Data Collector
# Collects uptime, latency, and error metrics for monitoring
# Usage: ./scripts/collect-slo-metrics.sh [--output metrics.json]

set -euo pipefail

OUTPUT_FILE="${1:-./monitoring/slo-metrics.json}"
DATA_DIR="$(dirname "$OUTPUT_FILE")"
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"

mkdir -p "$DATA_DIR"

if [[ -z "$REMOTE_HOST" ]]; then
    echo "REMOTE_HOST is not set. Export REMOTE_HOST (for example, deploy@your-host) before collecting SLO metrics." >&2
    exit 1
fi

# Create JSON output
collect_metrics() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local uptime_api="N/A"
    local uptime_frontend="N/A"
    local latency_api="N/A"
    local error_rate="N/A"
    local services_status="N/A"
    
    # Test API health
    if response=$(curl -s -w "\n%{http_code}" -m 5 "https://api.vitaloop.today/health"); then
        http_code=$(echo "$response" | tail -1)
        if [[ "$http_code" == "200" ]]; then
            uptime_api="ok"
        else
            uptime_api="error_$http_code"
        fi
    else
        uptime_api="timeout"
    fi
    
    # Test API readiness
    if response=$(curl -s -w "\n%{http_code}" -m 5 "https://api.vitaloop.today/health/ready"); then
        http_code=$(echo "$response" | tail -1)
        if [[ "$http_code" == "200" ]]; then
            uptime_api_ready="ok"
        else
            uptime_api_ready="warn_$http_code"
        fi
    else
        uptime_api_ready="error"
    fi
    
    # Test frontend
    if response=$(curl -s -w "\n%{http_code}" -m 5 "https://vitaloop.today"); then
        http_code=$(echo "$response" | tail -1)
        if [[ "$http_code" == "200" ]]; then
            uptime_frontend="ok"
        else
            uptime_frontend="error_$http_code"
        fi
    else
        uptime_frontend="timeout"
    fi
    
    # Get service status from server
    services_status=$(ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE_HOST" "
        printf '%s,' \"backend=\$(systemctl is-active vitaloop-backend)\"
        printf '%s' \"crm=\$(systemctl is-active vitaloop-crm-mvc)\"
    " 2>/dev/null || echo "backend=unknown,crm=unknown")
    
    # Get disk usage
    disk_usage=$(ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE_HOST" "
        df -h $REMOTE_DIR | tail -1 | awk '{print \$5}'
    " 2>/dev/null || echo "N/A")
    
    # Create JSON
    cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "uptime": {
    "api_health": "$uptime_api",
    "api_ready": "$uptime_api_ready",
    "frontend": "$uptime_frontend"
  },
  "services": {
    $services_status
  },
  "resources": {
    "disk_usage": "$disk_usage"
  }
}
EOF

    echo "Metrics collected at: $timestamp"
    cat "$OUTPUT_FILE"
}

collect_metrics
