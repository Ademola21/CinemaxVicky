# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Essential Commands

```bash
# Install all dependencies (includes automatic yt-dlp setup)
npm install

# Start development server (runs frontend + backend concurrently)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Build System Commands

```bash
# Build client-side only (React frontend)
npm run build:client

# Build server-side only (Node.js backend)
npm run build:server

# Manual yt-dlp setup (if needed)
npm run setup-ytdlp
```

### VPS-Specific Commands

```bash
# Production build for VPS deployment
npm run vps:build

# Start in production mode
npm run vps:start

# Development mode for VPS
npm run vps:dev
```

### Bot Development

The Telegram bot has its own build system in the `/bot` directory:

```bash
# Build bot (from /bot directory)
cd bot && npm run build

# Run bot directly (from /bot directory)
cd bot && npm run dev

# Start built bot (from /bot directory)
cd bot && npm start
```

### Testing Commands

```bash
# Test server health
curl http://localhost:5000/

# Test YouTube downloader functionality
curl http://localhost:5000/api/test-ytdlp

# Test Azure OpenAI proxy (requires valid session)
curl -X POST http://localhost:5000/api/azure-ai
```

## Architecture Overview

### Project Structure

This is a full-stack Yoruba movie streaming platform with multiple integrated systems:

- **Frontend**: React 19 + TypeScript SPA using Hash Router
- **Backend**: Express.js server with TypeScript
- **Bot**: Standalone Telegram bot for admin functionality
- **Build System**: ESBuild for fast client compilation, TypeScript for server
- **Data Storage**: File-based JSON storage system

### Key Architectural Components

#### Frontend Architecture (`/components`, `/pages`, `/contexts`)

**Context Providers** (app-wide state management):
- `AuthContext`: User authentication, sessions, admin roles
- `MovieContext`: Movie data fetching and caching
- `SiteConfigContext`: Dynamic site configuration

**Page Structure**:
- Lazy-loaded pages with React.Suspense
- Protected routes for authenticated users
- Static pages for legal content

**Core Components**:
- `Header/Footer`: Navigation and branding
- `MovieCard/MovieCarousel`: Movie display components
- `AiChatPopup`: AI-powered user assistance
- `SearchBar`: Movie search functionality

#### Backend Architecture (`server.ts`, `/api`)

**Main Server** (`server.ts`):
- Express application with JSON API endpoints
- Environment detection (Replit vs VPS)
- Rate limiting and session validation
- Azure OpenAI proxy for AI features
- YouTube downloader using yt-dlp-exec

**API Modules** (`/api`):
- `auth.ts`: Session validation and authentication
- `users.ts`: User management endpoints
- `comments.ts`: Comment system
- `youtube-downloader.ts`: Video download functionality
- `rateLimiter.ts`: Request throttling

#### Bot Architecture (`/bot`)

**Standalone Admin System**:
- `index.ts`: Environment validation and conditional startup
- `run.ts`: Main bot orchestrator
- `commands.ts`: Telegram command handlers
- `movieManager.ts`: Movie CRUD operations
- `userManager.ts`: User administration
- `youtubeService.ts`: YouTube API integration
- `aiHandler.ts`: AI-powered features
- `monitoringManager.ts`: System monitoring

#### Data Architecture (`/data`)

**File-based JSON Storage**:
- `movies.json`: Movie catalog with metadata
- `users.json`: User accounts and preferences
- `comments.json`: User comments and ratings
- `watchlists.json`: User watchlist data
- `viewingHistory.json`: User viewing analytics
- `collections.json`: Curated movie collections
- `actors.json`: Actor information and filmography
- `siteConfig.json`: Dynamic site configuration

### Service Layer (`/services`)

**Core Services**:
- `storageService.ts`: Unified data access layer
- `youtubeService.ts`: YouTube API integration
- `aiService.ts`: AI service abstraction
- `analyticsService.ts`: User behavior tracking
- `ytdlpBinaryManager.ts`: YouTube downloader management
- `sanitizer.ts`: Input validation and sanitization

## Environment Configuration

### Required Environment Variables

**Core Application**:
- `NODE_ENV`: Environment mode (`development`/`production`)
- `PORT`: Server port (auto-detected: 5000 for Replit, 5019 for VPS)

**AI Features (Optional)**:
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI service endpoint
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Model deployment name
- `GOOGLE_AI_API_KEY`: Fallback AI service

**Telegram Bot (Optional)**:
- `TELEGRAM_BOT_TOKEN`: Bot token from BotFather
- `ADMIN_TELEGRAM_USER_ID`: Admin user ID for bot access
- `YOUTUBE_API_KEY`: YouTube Data API key

**Storage (Optional)**:
- `AZURE_STORAGE_CONNECTION_STRING`: Azure Blob Storage
- `AZURE_CONTAINER_NAME`: Storage container name
- `CDN_BASE_URL`: CDN URL for media assets

### Platform-Specific Behavior

**Environment Detection Logic**:
- Replit: Detected via `REPL_ID` environment variable
- VPS/Local: Fallback environment
- Port auto-selection: 5000 (Replit) vs 5019 (VPS)

**Build System Differences**:
- ESBuild for fast client compilation
- TypeScript compilation for server code
- Concurrent development with file watching
- Automatic yt-dlp binary setup on install

## Development Best Practices

### Code Organization

- **Contexts**: Use React contexts for app-wide state management
- **Services**: Centralize API calls and data operations
- **Types**: Shared TypeScript interfaces in `/services/types.ts`
- **Components**: Reusable UI components with consistent naming

### Data Flow Patterns

- **Authentication**: Session-based auth with server-side validation
- **Movie Data**: Context-driven with API caching
- **AI Integration**: Graceful degradation when services unavailable
- **Bot Commands**: Event-driven architecture with command routing

### Error Handling

- **Network Failures**: Detailed error messages with troubleshooting steps
- **AI Service Failures**: Fallback to basic functionality
- **YouTube Downloader**: Comprehensive format selection and error recovery
- **Rate Limiting**: User-specific throttling with meaningful responses

### Security Considerations

- **Input Sanitization**: All user inputs sanitized before processing
- **Session Validation**: Centralized auth checking
- **Rate Limiting**: Per-user request throttling
- **Environment Secrets**: Proper environment variable handling

## Key Integration Points

### YouTube Downloader System

- **Technology**: yt-dlp-exec (Node.js package, no Python required)
- **Format Selection**: Smart filtering for optimal user experience
- **Audio Handling**: Automatic merging for video-only formats
- **Error Recovery**: Comprehensive fallback mechanisms

### AI Service Integration

- **Primary**: Azure OpenAI with GPT models
- **Fallback**: Google Generative AI
- **Features**: Natural language search, personalized recommendations
- **Error Handling**: Graceful degradation to basic functionality

### Telegram Bot Administration

- **Architecture**: Standalone process with shared data layer
- **Features**: Movie management, user analytics, system monitoring
- **Security**: Admin-only access with user ID validation
- **Integration**: Direct JSON file manipulation with the main application

### Storage System

- **Type**: File-based JSON storage for simplicity
- **Performance**: In-memory caching with file persistence
- **Scalability**: Suitable for medium-scale deployments
- **Backup**: Easy to backup and restore JSON files

This architecture emphasizes simplicity, reliability, and ease of deployment while providing rich functionality through external API integrations.