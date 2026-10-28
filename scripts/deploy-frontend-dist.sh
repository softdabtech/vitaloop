#!/bin/bash
# DEPRECATED 2026-09-10: this script rsync'd dist/ to a host path that a
# docker-compose.prod.yml volume mount used to shadow into the frontend
# container. That volume mount has been removed (it silently made every
# `docker build` on the frontend a no-op for what actually served — the
# frontend image is now the sole source of truth, see docker-compose.prod.yml
# and frontend/Dockerfile.prod for why). Running this script now would copy
# files nginx never reads and would look like a successful deploy while
# doing nothing.
#
# Use scripts/deploy-docker.sh instead — it builds the frontend image
# (docker compose build) and recreates the container from it.
echo "❌ deploy-frontend-dist.sh is deprecated and does nothing useful anymore." >&2
echo "   Use scripts/deploy-docker.sh instead." >&2
exit 1
