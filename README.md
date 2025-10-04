# Yoruba Cinemax - Movie Streaming Platform

A full-stack Yoruba movie streaming platform with React TypeScript frontend, Node.js/Express backend, AI-powered features, and Telegram bot administration.

## 🚨 **IMPORTANT: For Replit Agent Import**

**⚠️ This project is pre-configured and ready to run. DO NOT modify any code during import!**

### ✅ **Replit Agent Instructions - FOLLOW EXACTLY:**

1. **DO NOT TOUCH THE CODE** - Everything is already configured correctly
2. **ONLY install Node.js 20** if not already installed: `programming_language_install_tool(["nodejs-20"])`
3. **ONLY run** `npm install` to install dependencies  
4. **ONLY set up the workflow** with existing "Server" configuration using `npm run dev`
5. **DO NOT modify any files** - The project is production-ready as-is

### 🔧 **What's Already Configured:**
- ✅ Port detection (auto-detects Replit vs VPS)
- ✅ TypeScript configuration optimized for Node.js 20+
- ✅ Build system (ESBuild) works perfectly  
- ✅ Frontend serves on correct port with cache headers for Replit iframe
- ✅ Backend API endpoints all functional
- ✅ YouTube downloader using yt-dlp-exec (no Python needed)
- ✅ Development workflow with concurrently

### 🚫 **DO NOT:**
- Modify package.json scripts
- Change port configurations  
- Update TypeScript settings
- Modify build system
- Install additional packages
- Change file structure
- Update dependencies
- Run formatters, migrations, upgrades, or code generators (e.g., eslint --fix, prettier, npm audit fix, npm update)

### 📦 **Environment Setup:**
- Create `.env` file for API keys if needed
- All other configuration is automatic

### 🎯 **Expected Result:**
- Run `npm install` → Install dependencies
- Run `npm run dev` → Start development server
- Application loads successfully on port 5000
- All features work immediately

**⚠️ If the workflow fails, STOP and ask for guidance; do not attempt fixes that change files or configuration.**

**This project has been battle-tested and works perfectly as-is. Any modifications during import will likely break functionality!**

---

## 🏗️ **VPS Deployment**

For VPS deployment instructions, see `VPS-DEPLOYMENT.md`.

## 📋 **VPS Startup Packages**

### **Production Runtime** (recommended for production auto-install):
```
@azure/openai @azure/storage-blob @google/generative-ai dotenv express hls.js node-telegram-bot-api react react-dom react-router-dom vite yt-dlp-exec ytdl-core
```

### **Complete Package List** (runtime + development tools):
```
@azure/openai @azure/storage-blob @google/generative-ai dotenv express hls.js node-telegram-bot-api react react-dom react-router-dom vite yt-dlp-exec ytdl-core @types/express @types/node @types/node-telegram-bot-api @types/react @types/react-dom concurrently esbuild ts-node ts-node-dev typescript
```

## 🎬 **Features**

- **Movie Streaming**: HLS video playback with seeking support
- **YouTube Integration**: Download functionality using yt-dlp-exec (no Python required)
- **AI-Powered**: Azure OpenAI for recommendations and chat
- **Telegram Bot**: Complete admin interface for content management
- **User Management**: Authentication, watchlists, viewing history
- **Responsive Design**: Modern UI with Tailwind CSS

## 🛠️ **Tech Stack**

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript  
- **Build**: ESBuild for fast compilation
- **Video**: HLS.js for adaptive streaming
- **AI**: Azure OpenAI + Google Generative AI
- **Bot**: Telegram Bot API
- **Storage**: File-based JSON database

## 🔧 **Development**

```bash
# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📱 **Environment Variables**

Create `.env` file with your API keys:

```env
# Azure OpenAI (optional - for AI features)
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment

# Telegram Bot (optional - for admin features)  
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_ID=your_admin_id

# Google AI (optional - fallback AI)
GOOGLE_AI_API_KEY=your_key

# Azure Storage (optional - for poster uploads)
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```

**Note**: All features work without API keys - they gracefully degrade to basic functionality.

## 🎯 **Key Features**

### 🎥 **YouTube Downloader**
- **No Python Required**: Uses yt-dlp-exec Node.js package
- **Smart Filtering**: Shows 1 video format per resolution (prefers MP4, falls back to WebM)
- **Audio Optimization**: 2 audio options (lowest/highest quality), auto-merges with video-only formats
- **Clean Labels**: Standardized resolution display (144p, 720p, 1080p, 2160p (4K))

### 🤖 **AI Integration**
- **Natural Language Search**: Find movies using conversational queries
- **Personalized Recommendations**: Based on viewing history and preferences
- **Smart Assistance**: AI-powered chat support for users

### 📱 **Telegram Bot Admin**
- **Movie Management**: Add/edit/delete movies with YouTube integration
- **User Analytics**: Track user activity and engagement
- **Site Configuration**: Update settings and content dynamically
- **Automated Monitoring**: Real-time alerts and system status

## 📄 **License**

ISC License - See LICENSE file for details.

---

**Built with ❤️ for Yoruba cinema enthusiasts**