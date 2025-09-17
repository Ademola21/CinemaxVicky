# Overview

Yoruba Cinemax is a full-stack movie streaming platform dedicated to Yoruba cinema. The application features a React TypeScript frontend with a Node.js/Express backend, enhanced by AI-powered features and Telegram bot administration. It provides users with movie browsing, streaming, personalized recommendations, and social features like watchlists and comments. The platform includes a YouTube downloader tool and comprehensive admin capabilities through a Telegram bot interface.

# User Preferences

Preferred communication style: Simple, everyday language.

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