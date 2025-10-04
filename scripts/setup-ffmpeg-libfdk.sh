#!/bin/bash

# Setup script for installing FFmpeg with libfdk_aac support
# Works on both Replit and VPS environments

echo "🔧 Installing FFmpeg with libfdk_aac support..."

# Create ffmpeg-bin directory and download
mkdir -p ~/ffmpeg-bin

# Download FFmpeg binary with libfdk_aac support from homebridge
curl -L "https://github.com/homebridge/ffmpeg-for-homebridge/releases/latest/download/ffmpeg-alpine-$(uname -m).tar.gz" \
  | tar xzf - -C ~/ffmpeg-bin

# Add to PATH if not already added
if ! grep -q 'ffmpeg-bin/usr/local/bin' ~/.bashrc; then
  echo 'export PATH="$HOME/ffmpeg-bin/usr/local/bin:$PATH"' >> ~/.bashrc
  echo "✅ Added FFmpeg to PATH in ~/.bashrc"
else
  echo "✅ FFmpeg already in PATH"
fi

# Export for current session
export PATH="$HOME/ffmpeg-bin/usr/local/bin:$PATH"

# Verify installation
if command -v ffmpeg &> /dev/null; then
  echo "✅ FFmpeg installed successfully!"
  echo "📦 FFmpeg version:"
  ~/ffmpeg-bin/usr/local/bin/ffmpeg -version | head -1
  
  # Check for libfdk_aac support
  if ~/ffmpeg-bin/usr/local/bin/ffmpeg -encoders 2>&1 | grep -q libfdk_aac; then
    echo "✅ libfdk_aac encoder is available!"
  else
    echo "❌ libfdk_aac encoder not found"
    exit 1
  fi
else
  echo "❌ FFmpeg installation failed"
  exit 1
fi

echo ""
echo "🎉 Setup complete! FFmpeg with libfdk_aac is ready to use."
echo "📝 Your videos will now use HE-AAC (AAC LC SBR) audio - compatible with all TVs!"
