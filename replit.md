# Overview

Yoruba Cinemax is a full-stack movie streaming platform dedicated to Yoruba cinema. The application features a React TypeScript frontend with a Node.js/Express backend, enhanced by AI-powered features and Telegram bot administration. It provides users with movie browsing, streaming, personalized recommendations, and social features like watchlists and comments. The platform includes a YouTube downloader tool and comprehensive admin capabilities through a Telegram bot interface.

# Recent Changes

**September 24, 2025 - YouTube Downloader Migration to yt-dlp-exec (Latest):**
- ✅ **MIGRATED**: Complete migration from Python yt-dlp to yt-dlp-exec Node.js package
- ✅ **IMPROVED**: Filtering system now shows only one video format per resolution (lowest file size, prefer MP4)
- ✅ **ENHANCED**: Audio format selection - shows only lowest and highest file size audio formats  
- ✅ **IMPLEMENTED**: Auto-merging for video-only formats with lowest audio format
- ✅ **STANDARDIZED**: Clean resolution labels (144p, 240p, 360p, 720p, 1080p, 2160p (4K))
- ✅ **OPTIMIZED**: Format reduction from 15+ raw formats to 4 optimized selections
- ✅ **CLEANED**: Removed all Python yt-dlp dependencies and installation scripts
- ✅ **UPDATED**: VPS deployment documentation to reflect new yt-dlp-exec approach
- ✅ **MAINTAINED**: Same download functionality and reliability as before
- **Result**: More efficient and reliable YouTube downloading with better format selection

**September 23, 2025 - VPS Compatibility and Error Handling Improvements:**
- ✅ **ENHANCED**: Real environment detection - automatically detects Replit via REPL_ID env var, defaults VPS to 5019
- ✅ **IMPROVED**: Azure OpenAI error handling with VPS-specific network error messages
- ✅ **ENHANCED**: YouTube downloader with better error handling
- ✅ **ADDED**: VPS deployment instructions and environment-specific error handling
- ✅ **MIGRATED**: From Python yt-dlp to yt-dlp-exec Node.js package for better reliability
- ✅ **IMPROVED**: DNS/network error handling for Azure OpenAI on VPS
- ✅ **DOCUMENTED**: Comprehensive VPS setup guide for future deployments
- **Result**: Application now works seamlessly on both Replit and VPS with proper error handling

**September 23, 2025 - GitHub Import Setup Completed Successfully:**
- ✅ **UPGRADED**: Node.js from v18 to v20 for full compatibility with latest Azure OpenAI dependencies
- ✅ **CONFIGURED**: Development workflow with concurrently running frontend and backend
- ✅ **CONFIGURED**: Port configuration - smart detection for Replit vs VPS environments
- ✅ **RESOLVED**: All TypeScript compilation errors and module resolution issues
- ✅ **VERIFIED**: Application loads successfully with full UI functionality
- ✅ **CONFIGURED**: Deployment settings for autoscale production deployment
- ✅ **MAINTAINED**: Existing cache control headers for Replit iframe compatibility
- **Result**: Application is fully functional in Replit environment with complete development and deployment setup

**September 22, 2025 - YouTube Downloader Chrome Compatibility Fixed:**
- ✅ **RESOLVED**: Chrome "download failed" issue by implementing robust two-stage download process
- ✅ **RESOLVED**: Video seeking/fast-forwarding problems - yt-dlp completes merge before streaming
- ✅ **RESOLVED**: Accurate file size display in Chrome (no more "?" indicators)  
- ✅ **RESOLVED**: Container format compatibility - yt-dlp chooses optimal format without forced MP4 conversion
- ✅ **RESOLVED**: Automatic Content-Type detection based on actual output file extension
- ✅ **RESOLVED**: Proper temporary file cleanup with client disconnect handling
- **Result**: Downloads now work perfectly in Chrome with full seeking capability and accurate file information

**September 21, 2025 - GitHub Import Setup Completed:**
- Successfully imported GitHub project into Replit environment
- Upgraded Node.js from v18 to v20 for compatibility with latest Azure dependencies
- Installed all project dependencies via npm install
- Resolved initial TypeScript compilation errors and module resolution issues
- Configured development workflow running on port 5000 with hot reloading via concurrently
- Verified frontend configuration allows all hosts for Replit proxy compatibility
- Set up deployment configuration for autoscale deployment target with proper build/run commands
- Tested application functionality - frontend loads correctly with proper styling and navigation
- Application is running successfully with proper cache control headers for Replit iframe compatibility
- All core features working: movie streaming interface, authentication system, API endpoints
- Fixed YouTube downloader audio merging: implemented yt-dlp audio merging logic for video-only formats
- Videos now download with proper audio using "formatId+bestaudio" when video-only formats are selected

**September 21, 2025 - YouTube Downloader Improvements:**
- Integrated improved format selection logic from user's yt.js code
- Implemented `getStandardQuality()` function for consistent quality mapping (144p, 720p, 2160p (4K), etc.)
- Added `selectBestFormats()` function with intelligent format filtering and preference-based selection
- Fixed file size display issues by using `actualFilesize ?? filesize` for proper size calculation
- Updated frontend display with format preference indicators: ⭐ for MP4, 📹 for WEBM, 📄 for others
- Changed format display to list-style with detailed format information: "[0] ⭐ 144p | MP4 + bestaudio | 1.1 MB | id=160"
- Significantly reduced format clutter from 62 total formats to 18 optimized selections (54 video → 16 video)
- Improved format organization with smarter MP4/WEBM selection and size-based alternatives

# User Preferences

Preferred communication style: Simple, everyday language.

# Replit Import Instructions

**IMPORTANT FOR FUTURE REPLIT IMPORTS:**

This project is pre-configured for both Replit and VPS environments. When importing this project:

## DO NOT MODIFY:
- ✅ **Port Configuration**: Real environment detection (checks REPL_ID for Replit=5000, otherwise VPS=5019)
- ✅ **Package.json Scripts**: Pre-configured for concurrently running frontend/backend
- ✅ **TypeScript Configuration**: Already optimized for Node.js 20+
- ✅ **Build System**: ESBuild setup works perfectly as-is
- ✅ **Static File Serving**: Express server handles both frontend and API
- ✅ **Cache Headers**: Already configured for Replit iframe compatibility

## REPLIT SETUP STEPS:
1. **Install Node.js 20**: Use `programming_language_install_tool` if needed
2. **Install Dependencies**: Run `npm install` (already configured in package.json)
3. **Set Workflow**: Use existing "Server" workflow with `npm run dev` on detected port
4. **Environment Variables**: Create `.env` file with your API keys if needed

## VPS DEPLOYMENT:
- Follow the comprehensive guide in `VPS-DEPLOYMENT.md`
- The application auto-detects VPS environment and uses port 5019
- All error handling for missing dependencies (yt-dlp, Azure OpenAI) is built-in

## KNOWN WORKING CONFIGURATION:
- **Frontend**: React + TypeScript + ESBuild + Tailwind CSS
- **Backend**: Express + TypeScript + ts-node-dev
- **Architecture**: Single server serving both static files and API
- **Development**: Concurrently runs frontend build and backend server
- **Production**: Single `npm start` command serves everything

# System Architecture

## Frontend Architecture
- **Framework**: React 19.1.1 with TypeScript for type safety
- **Routing**: React Router DOM v7 with hash-based routing for client-side navigation
- **State Management**: Context API for global state (Auth, Movies, SiteConfig)
- **Styling**: Tailwind CSS via CDN for rapid UI development
- **Build System**: ESBuild for fast bundling and development
- **Lazy Loading**: Dynamic imports for code splitting and performance optimization

## Backend Architecture
- **Server**: Express.js serving both API endpoints and static files
- **File-based Database**: JSON files for data persistence (users, movies, comments, etc.)
- **Authentication**: Simple session-based auth with password hashing using Web Crypto API
- **API Structure**: RESTful endpoints for users, comments, AI services, and YouTube downloader
- **Security**: Rate limiting, input sanitization, atomic file writes to prevent corruption

## Data Storage Solutions
- **Primary Storage**: JSON files in `/data` directory for all application data
- **File Structure**:
  - `movies.json` - Movie catalog with metadata
  - `users.json` - User accounts and authentication data
  - `watchlists.json` - User movie preferences
  - `viewingHistory.json` - User activity tracking
  - `comments.json` - Movie reviews and ratings
  - `siteConfig.json` - Dynamic site configuration
  - `collections.json` - Curated movie groupings
- **Atomic Operations**: Temporary file writes with rename operations to ensure data integrity

## Authentication and Authorization
- **User Management**: Email/password authentication with role-based access
- **Session Handling**: JWT-like tokens with expiration validation
- **Protected Routes**: Frontend route guards for authenticated content
- **Rate Limiting**: Per-user request throttling for API endpoints
- **Password Security**: SHA-256 hashing for credential storage

## AI Integration Architecture
- **Primary AI Service**: Azure OpenAI integration with GPT-4 deployment
- **AI Features**:
  - Natural language movie search and recommendations
  - Personalized content suggestions based on viewing history
  - AI-powered chat assistant for user support
  - Smart movie metadata generation
- **Fallback Strategy**: Graceful degradation when AI services are unavailable
- **Rate Limiting**: Per-user AI request throttling to manage costs

## Video Streaming
- **HLS Support**: HTTP Live Streaming for adaptive video playback
- **YouTube Integration**: Download functionality via third-party API proxy
- **Live TV**: Configurable live streaming with HLS.js player
- **Content Delivery**: Direct video serving with proper media headers

## Admin System
- **Telegram Bot**: Complete administrative interface for content management
- **Bot Features**:
  - Movie CRUD operations with YouTube API integration
  - User management and analytics
  - Site configuration updates
  - Automated content discovery and monitoring
  - AI-powered content suggestions and analytics
- **Security**: Admin-only access via Telegram user ID validation

# External Dependencies

## Core Services
- **Azure OpenAI**: AI-powered features including chat, recommendations, and content generation
- **YouTube Data API v3**: Video metadata retrieval and content discovery
- **Telegram Bot API**: Administrative interface and notifications

## Third-party APIs
- **Cobalt YouTube Downloader** (`https://co.wuk.sh/api/json`): Proxied YouTube video download service
- **Picsum Photos**: Placeholder images for movie posters and actor profiles
- **Test Streams (Mux)**: Demo HLS streaming content for live TV functionality

## CDN Dependencies
- **Tailwind CSS**: Styling framework loaded via CDN
- **HLS.js**: Video streaming library with integrity verification
- **React/React-DOM**: Core framework loaded via importmap
- **Google Fonts**: Inter font family for typography

## Development Tools
- **ESBuild**: Fast JavaScript bundling and TypeScript compilation
- **Concurrently**: Parallel development server management
- **TypeScript**: Type checking and compilation
- **Node.js Built-ins**: File system operations, crypto, path utilities