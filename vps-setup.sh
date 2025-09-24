#!/bin/bash

# VPS Setup Script for Yoruba Cinemax
echo "🚀 Setting up Yoruba Cinemax on VPS..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm if not installed
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Python yt-dlp no longer needed - now using yt-dlp-exec Node.js package
# Only installing Python for any other potential Python dependencies
echo "🐍 Installing Python (for potential Python dependencies)..."
sudo apt install -y python3 python3-pip python3-venv

# Install ffmpeg (required for yt-dlp audio merging)
echo "🎵 Installing ffmpeg..."
sudo apt install -y ffmpeg

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Create data directory if it doesn't exist
echo "📁 Setting up data directory..."
mkdir -p data

# Set proper permissions for data directory
echo "🔐 Setting file permissions..."
chmod 755 data
chmod 644 data/*.json 2>/dev/null || echo "No JSON files found yet"

# Build the project
echo "🔨 Building project..."
npm run build

# Create systemd service file
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/yoruba-cinemax.service > /dev/null <<EOF
[Unit]
Description=Yoruba Cinemax Movie Streaming Platform
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
Environment=PORT=5019
ExecStart=$(which npm) start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable yoruba-cinemax

echo "✅ VPS setup completed!"
echo ""
echo "🔧 Next steps:"
echo "1. Create your .env file with your configuration"
echo "2. Start the service: sudo systemctl start yoruba-cinemax"
echo "3. Check status: sudo systemctl status yoruba-cinemax"
echo "4. View logs: sudo journalctl -u yoruba-cinemax -f"
echo ""
echo "🌐 Your website will be available at: http://38.54.63.140:5019"