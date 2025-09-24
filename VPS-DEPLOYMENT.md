# VPS Deployment Guide

This guide will help you deploy the Yoruba Cinemax application to your VPS (Virtual Private Server).

## Prerequisites

Your VPS should have:
- **Node.js 20+** (required for Azure OpenAI dependencies and yt-dlp-exec)
- **Git** (to clone the repository)
- **PM2** (optional, for process management)
- **FFmpeg** (for video/audio processing)

## Step 1: Server Setup

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg for video/audio processing
sudo apt install ffmpeg -y

# Verify installations
node --version  # Should be v20.x.x
ffmpeg -version  # Should show FFmpeg version

# Note: yt-dlp-exec (Node.js package) will be installed automatically via npm install

# Optional: Install PM2 for process management
sudo npm install -g pm2
```

## Step 2: Deploy Your Application

```bash
# Clone your repository (replace with your repo URL)
git clone <your-repo-url>
cd yoruba-cinemax

# Install dependencies
npm install

# Build the application
npm run build
```

## Step 3: Environment Configuration

Create a `.env` file in your project root:

```bash
# VPS Configuration
NODE_ENV=production
PORT=5019

# Azure OpenAI Configuration (required for AI features)
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name

# Telegram Bot Configuration (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
ADMIN_TELEGRAM_USER_ID=your-user-id

# Azure Storage Configuration (optional - for poster uploads)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_CONTAINER_NAME=media
CDN_BASE_URL=your-cdn-url

# YouTube API (optional - for enhanced video info)
YOUTUBE_API_KEY=your-youtube-api-key
```

## Step 4: Start the Application

### Option A: Direct Start
```bash
# Start in production mode
npm start
```

### Option B: Using PM2 (Recommended)
```bash
# Start with PM2
pm2 start npm --name "yoruba-cinemax" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown by the command above
```

## Step 5: Configure Firewall

Make sure port 5019 is open:

```bash
# For UFW (Ubuntu Firewall)
sudo ufw allow 5019

# For iptables
sudo iptables -A INPUT -p tcp --dport 5019 -j ACCEPT
```

## Step 6: Access Your Application

Your application will be available at:
- `http://your-vps-ip:5019`
- Or configure a domain with a reverse proxy (nginx/apache)

## Troubleshooting

### AI Features Not Working
If you see "AI service temporarily unavailable" errors:

1. **Check Azure OpenAI Configuration:**
   ```bash
   # Test endpoint connectivity
   curl -I https://your-resource.cognitiveservices.azure.com/
   ```

2. **Verify Environment Variables:**
   ```bash
   # Check if variables are set
   echo $AZURE_OPENAI_ENDPOINT
   echo $AZURE_OPENAI_API_KEY
   ```

3. **Network Issues:**
   - Ensure your VPS can reach Azure endpoints
   - Check DNS resolution: `nslookup your-resource.cognitiveservices.azure.com`
   - Contact your VPS provider if network issues persist

### YouTube Downloader Not Working
If you see YouTube downloader errors:

1. **Check yt-dlp-exec installation:**
   ```bash
   # Verify Node.js dependencies are installed
   npm install
   
   # Test the YouTube functionality
   curl http://localhost:5019/api/test-ytdlp
   ```

2. **Check FFmpeg installation:**
   ```bash
   ffmpeg -version
   
   # Install if missing
   sudo apt install ffmpeg -y
   ```

3. **Network Issues:**
   ```bash
   # Test YouTube connectivity
   curl -I https://youtube.com
   ```

### General Debug Steps

1. **Check Application Logs:**
   ```bash
   # If using PM2
   pm2 logs yoruba-cinemax
   
   # If running directly
   npm start  # Check console output
   ```

2. **Test API Endpoints:**
   ```bash
   # Test yt-dlp
   curl http://localhost:5019/api/test-ytdlp
   
   # Test server health
   curl http://localhost:5019/
   ```

3. **Check Process:**
   ```bash
   # See if app is running
   netstat -tlnp | grep 5019
   ps aux | grep node
   ```

## Reverse Proxy Setup (Optional)

To use a domain name instead of IP:port, configure nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5019;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Maintenance

```bash
# Update application
git pull
npm install
npm run build
pm2 restart yoruba-cinemax

# Monitor logs
pm2 monit

# Backup data files
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## Need Help?

- Check the console logs for specific error messages
- Ensure all environment variables are correctly set
- Verify network connectivity to external services
- Contact your VPS provider for network-related issues