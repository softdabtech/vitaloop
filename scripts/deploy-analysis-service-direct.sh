#!/bin/bash

# Deploy analysis service directly to production server
# Usage: ./scripts/deploy-analysis-service-direct.sh

set -e

OCR_PROVIDER="${OCR_PROVIDER:-tesseract}"
OCR_CANARY_PERCENT="${OCR_CANARY_PERCENT:-0}"
INSTALL_PADDLE="${INSTALL_PADDLE:-false}"

echo "🚀 Deploying analysis service to production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server details
SERVER="root@159.65.252.227"
REMOTE_PATH="/opt/analysis-service"
SERVICE_NAME="analysis-service"

echo -e "${YELLOW}📦 Building and deploying analysis service...${NC}"

# Create deployment package
echo "Creating deployment package..."
cd /Users/oleksii/projects/vitaloop/analysis-service
ARCHIVE_PATH="/tmp/analysis-service-$(date +%s).tar.gz"
tar -czf "$ARCHIVE_PATH" \
    --exclude='venv' \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='analysis-service.tar.gz' \
    --exclude='.pytest_cache' \
    .

# Upload to server
echo "Uploading to server..."
scp "$ARCHIVE_PATH" $SERVER:/tmp/analysis-service.tar.gz

# Deploy on server
ssh $SERVER << EOF
    set -e

    echo "Installing OCR system dependencies (tesseract + poppler + runtime libs)..."
    apt-get update -y
    apt-get install -y tesseract-ocr poppler-utils libgl1 libglib2.0-0
    
    echo "Stopping existing service..."
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    
    echo "Setting up deployment directory..."
    mkdir -p $REMOTE_PATH
    cd $REMOTE_PATH
    
    echo "Extracting new version..."
    tar -xzf /tmp/analysis-service.tar.gz
    rm /tmp/analysis-service.tar.gz
    
    echo "Setting up Python environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install --no-cache-dir -r requirements.txt
    if [ "$INSTALL_PADDLE" = "true" ]; then
        echo "Installing optional Paddle OCR dependencies..."
        pip install --no-cache-dir -r requirements-paddle.txt || echo "⚠️ Paddle optional deps failed; continuing with fallback engines"
    fi
    
    echo "Creating systemd service..."
    cat > /etc/systemd/system/$SERVICE_NAME.service << SERVICE_EOF
[Unit]
Description=Analysis Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REMOTE_PATH
Environment=OCR_PROVIDER=$OCR_PROVIDER
Environment=OCR_FALLBACK_CHAIN=tesseract
Environment=OCR_ENABLE_MOCK_FALLBACK=false
Environment=OCR_CANARY_PERCENT=$OCR_CANARY_PERCENT
Environment=OCR_MAX_PDF_PAGES=2
Environment=OCR_PDF_DPI=180
Environment=OCR_PDF_THREAD_COUNT=1
Environment=OMP_THREAD_LIMIT=1
ExecStart=$REMOTE_PATH/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8006
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE_EOF
    
    echo "Reloading systemd and starting service..."
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl start $SERVICE_NAME
    
    echo "Waiting for service to start..."
    sleep 5

    echo "Verifying Tesseract install..."
    tesseract --version | head -n 1
    
    echo "Checking service status..."
    systemctl status $SERVICE_NAME --no-pager
    
    echo "Testing health endpoint..."
    curl -f http://localhost:8006/health || exit 1
    
    echo "Opening firewall port..."
    ufw allow 8006/tcp
    
    echo "✅ Deployment completed successfully!"
EOF

# Cleanup
rm -f "$ARCHIVE_PATH"

echo -e "${GREEN}🎉 Analysis service deployed successfully!${NC}"
echo -e "${GREEN}🌐 Service URL: http://159.65.252.227:8006${NC}"
echo -e "${GREEN}💚 Health check: http://159.65.252.227:8006/health${NC}"