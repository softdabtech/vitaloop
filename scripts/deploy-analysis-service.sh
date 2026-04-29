#!/bin/bash

# Deploy analysis service using Docker
# Usage: ./scripts/deploy-analysis-service.sh

set -e

echo "🐳 Deploying analysis service with Docker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server details
SERVER="root@159.65.252.227"

echo -e "${YELLOW}📦 Building Docker image...${NC}"

# Build Docker image locally
cd /Users/oleksii/projects/vitaloop/analysis-service
docker build -t analysis-service:latest .

echo -e "${YELLOW}🚀 Deploying to server...${NC}"

# Deploy to server
ssh $SERVER << EOF
    set -e
    
    echo "Stopping existing container..."
    docker stop analysis-service 2>/dev/null || true
    docker rm analysis-service 2>/dev/null || true
    
    echo "Cleaning up old images..."
    docker image prune -f
    
    echo "✅ Ready for deployment!"
    echo "Please manually transfer the Docker image to the server:"
    echo "1. Save image: docker save analysis-service:latest > analysis-service.tar"
    echo "2. Upload to server: scp analysis-service.tar $SERVER:/tmp/"
    echo "3. Load on server: docker load < /tmp/analysis-service.tar"
    echo "4. Run container: docker run -d --name analysis-service -p 8006:8006 analysis-service:latest"
    echo "5. Open firewall: ufw allow 8006/tcp"
EOF

echo -e "${GREEN}📋 Deployment preparation completed!${NC}"
echo -e "${YELLOW}⚠️  Manual steps required on server${NC}"