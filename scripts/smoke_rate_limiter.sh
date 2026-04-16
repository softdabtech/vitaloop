#!/bin/bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://api.vitaloop.today}"
TARGET_PATH="${RATE_LIMIT_TARGET_PATH:-/protocol/__rate_limit_smoke__}"
BURST_REQUESTS="${RATE_LIMIT_BURST_REQUESTS:-40}"
MIN_429="${RATE_LIMIT_MIN_429:-1}"
MAX_TIME="${RATE_LIMIT_MAX_TIME:-5}"
PAUSE_SECONDS="${RATE_LIMIT_PAUSE_SECONDS:-0}"
WINDOW_SECONDS="${RATE_LIMIT_WINDOW_SECONDS:-60}"
ALIGN_WINDOW="${RATE_LIMIT_ALIGN_WINDOW:-1}"

if ! [[ "$BURST_REQUESTS" =~ ^[0-9]+$ ]] || [[ "$BURST_REQUESTS" -lt 1 ]]; then
    echo "BURST_REQUESTS must be a positive integer" >&2
    exit 2
fi

if ! [[ "$MIN_429" =~ ^[0-9]+$ ]]; then
    echo "MIN_429 must be a non-negative integer" >&2
    exit 2
fi

if ! [[ "$WINDOW_SECONDS" =~ ^[0-9]+$ ]] || [[ "$WINDOW_SECONDS" -lt 1 ]]; then
    echo "WINDOW_SECONDS must be a positive integer" >&2
    exit 2
fi

URL="${API_BASE_URL%/}${TARGET_PATH}"

echo "Rate limiter smoke"
echo "URL: $URL"
echo "Burst requests: $BURST_REQUESTS"
echo "Expected minimum 429 responses: $MIN_429"

if [[ "$ALIGN_WINDOW" == "1" ]]; then
    now_epoch="$(date +%s)"
    secs_to_next_window=$((WINDOW_SECONDS - (now_epoch % WINDOW_SECONDS)))
    if [[ "$secs_to_next_window" -eq "$WINDOW_SECONDS" ]]; then
        secs_to_next_window=0
    fi
    if [[ "$secs_to_next_window" -gt 0 ]]; then
        echo "Aligning to next rate-limit window in ${secs_to_next_window}s..."
        sleep "$secs_to_next_window"
    fi
fi

count_2xx=0
count_4xx=0
count_5xx=0
count_429=0
count_other=0

for i in $(seq 1 "$BURST_REQUESTS"); do
    status="$(curl -sS --max-time "$MAX_TIME" -o /dev/null -w "%{http_code}" "$URL" || echo "000")"

    if [[ "$status" == "429" ]]; then
        count_429=$((count_429 + 1))
    elif [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
        count_2xx=$((count_2xx + 1))
    elif [[ "$status" =~ ^4[0-9][0-9]$ ]]; then
        count_4xx=$((count_4xx + 1))
    elif [[ "$status" =~ ^5[0-9][0-9]$ ]]; then
        count_5xx=$((count_5xx + 1))
    else
        count_other=$((count_other + 1))
    fi

    if [[ "$PAUSE_SECONDS" != "0" ]]; then
        sleep "$PAUSE_SECONDS"
    fi

done

echo "Results: 2xx=$count_2xx 4xx=$count_4xx 429=$count_429 5xx=$count_5xx other=$count_other"

if [[ "$count_429" -lt "$MIN_429" ]]; then
    echo "Rate limiter smoke failed: expected at least $MIN_429 responses with 429, got $count_429" >&2
    exit 1
fi

echo "Rate limiter smoke check passed"
