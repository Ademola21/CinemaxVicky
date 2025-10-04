// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// FIX: Changed import style to use `express.Request` and `express.Response` to resolve type conflicts.
import express from 'express';
import path from 'path';
import fs from 'fs';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { createReadStream, unlinkSync, statSync, readdirSync, existsSync } from 'fs';
import { runBot } from './bot/run';
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { validateSession } from './api/auth'; // Imported centralized auth validation
import usersRouter from './api/users';
import commentsRouter from './api/comments';
import { getYouTubeVideoInfo as getServerYouTubeVideoInfo, isValidYouTubeURL } from './services/serverYoutubeService';
import { ytdlpManager } from './services/ytdlpBinaryManager';
import { ffmpegService } from './services/ffmpegService';
import { downloadYouTubeWithHEAAC } from './services/downloadWithHEAAC';

// --- SERVER SETUP ---
const app = express();
// FIX: Explicitly parse the port to a number to satisfy the listen() function's type requirement.
// Port configuration with real environment detection
// Auto-detects Replit environment via REPL_ID, otherwise assumes VPS/local
const isReplit = !!process.env.REPL_ID;
const defaultPort = isReplit ? '5000' : '5019';
const PORT = parseInt(process.env.PORT || defaultPort, 10);

console.log(`🔍 Environment detected: ${isReplit ? 'Replit' : 'VPS/Local'} - Using port ${PORT}`);

// @FIX: The type errors in route handlers were causing this `app.use` call to fail type checking. Fixing the handlers resolves this.
app.use(express.json({ limit: '10mb' })); // Increase limit for profile pics

// --- SECURITY & HELPERS ---
const userRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const checkRateLimit = (userId: string) => {
    const now = Date.now();
    const timestamps = userRequests.get(userId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) return { limited: true };
    recentTimestamps.push(now);
    userRequests.set(userId, recentTimestamps);
    return { limited: false };
};

// Removed local validateSession as it's now imported from ./api/auth

// --- AZURE AI CLIENT SETUP ---
let azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

// Fix endpoint if it contains the full URL instead of base URL
if (azureEndpoint && azureEndpoint.includes('/openai/deployments/')) {
    const url = new URL(azureEndpoint);
    azureEndpoint = `${url.protocol}//${url.host}/`;
    console.log('🔧 Fixed endpoint format to:', azureEndpoint);
}

let azureClient: OpenAIClient | null = null;
if (azureEndpoint && azureApiKey) {
    try {
        azureClient = new OpenAIClient(azureEndpoint, new AzureKeyCredential(azureApiKey));
        console.log('✅ Azure OpenAI client initialized');
        console.log('Endpoint:', azureEndpoint);
        console.log('Deployment:', azureDeploymentName);
    } catch (error) {
        console.error('❌ Failed to initialize Azure OpenAI client:', error);
    }
} else {
    console.log('❌ Missing Azure OpenAI configuration:');
    console.log('Endpoint:', azureEndpoint ? '✓' : '✗');
    console.log('API Key:', azureApiKey ? '✓' : '✗');
    console.log('Deployment:', azureDeploymentName ? '✓' : '✗');
}


// --- API ROUTES (MIGRATED FROM /api) ---

// Azure OpenAI Proxy
// @FIX: Use express.Request and express.Response for proper type inference.
app.post('/api/azure-ai', async (req: express.Request, res: express.Response) => {
    if (!azureClient || !azureDeploymentName) {
        return res.status(500).json({ error: 'Azure AI service not configured on the server.' });
    }
    try {
        const { params, session } = req.body;
        // Use the imported validateSession function
        if (!validateSession(session)) {
            return res.status(401).json({ error: 'Unauthorized: Invalid session.' });
        }
        if (checkRateLimit(session.user.id).limited) {
            return res.status(429).json({ error: 'Too Many Requests.' });
        }

        // Extract data from the Gemini-style request format
        const systemInstruction = params.config?.systemInstruction || '';
        const userPrompt = params.contents || '';
        const max_tokens = params.max_tokens || 2048;
        const json_mode = params.json_mode || false;

        const messages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
        ];

        console.log('Azure config - Endpoint:', azureEndpoint);
        console.log('Azure config - Deployment:', azureDeploymentName);
        console.log('Calling getChatCompletions...');

        const result = await azureClient.getChatCompletions(
            azureDeploymentName,
            messages,
            {
                maxTokens: max_tokens || 2048,
                ...(json_mode && { responseFormat: { type: "json_object" } })
            }
        );

        const responseContent = result.choices[0].message?.content || '{}';
        res.status(200).json({ text: responseContent });

    } catch (error: any) {
        console.error('Error in Azure AI proxy:', error);

        // Safely extract error details with fallbacks
        const errorCode = error?.code || 'UNKNOWN';
        const errorMessage = error?.message || 'Unknown error occurred';

        // Handle specific VPS network errors with robust field checking
        if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
            res.status(500).json({
                error: 'AI service temporarily unavailable. Check your network connection and Azure OpenAI configuration.',
                details: `Network error: Cannot reach Azure OpenAI endpoint. ${errorMessage}`,
                troubleshooting: {
                    vps: 'Ensure your VPS can reach Azure endpoints and check DNS settings',
                    config: 'Verify AZURE_OPENAI_ENDPOINT is correct in your .env file',
                    network: 'Test connectivity: curl -I [your-azure-endpoint]'
                }
            });
        } else if (errorMessage.includes('getaddrinfo') || errorCode === 'EAI_NODATA') {
            res.status(500).json({
                error: 'DNS resolution failed for AI service.',
                details: errorMessage,
                troubleshooting: {
                    dns: 'Check your DNS configuration or contact your VPS provider',
                    test: 'Try: nslookup [your-azure-endpoint-domain]'
                }
            });
        } else if (errorCode === 'ECONNREFUSED') {
            res.status(500).json({
                error: 'Connection refused by AI service.',
                details: errorMessage,
                troubleshooting: {
                    firewall: 'Check firewall settings allowing outbound HTTPS',
                    endpoint: 'Verify your Azure OpenAI endpoint URL is correct'
                }
            });
        } else {
            res.status(500).json({
                error: 'AI service error occurred',
                details: errorMessage,
                code: errorCode
            });
        }
    }
});

// YouTube Downloader using yt-dlp
// @FIX: Use express.Request and express.Response for proper type inference.
app.post('/api/youtube-downloader', async (req: express.Request, res: express.Response) => {
    try {
        const { url, session, formatId } = req.body;
        console.log('YouTube downloader request received:', {
            hasUrl: !!url,
            hasSession: !!session,
            hasFormatId: !!formatId
        });

        // Use the imported validateSession function
        if (!validateSession(session)) {
            console.log('Session validation failed for YouTube downloader');
            return res.status(401).json({ error: 'Unauthorized: You must be logged in to use this feature.' });
        }
        if (checkRateLimit(session.user.id).limited) {
            return res.status(429).json({ error: 'Too Many Requests.' });
        }
        if (!url || !isValidYouTubeURL(url)) {
            console.log('Invalid URL provided:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL.' });
        }

        console.log('Processing YouTube URL:', url);

        // Check if this is a request for download URL (has formatId)
        if (formatId) {
            console.log('Download URL request for format:', formatId);

            // Get video info to find the specific format
            const result = await getServerYouTubeVideoInfo(url);

            if (!result.success || !result.data) {
                const errorMsg = result.error || 'Failed to process video';
                console.error('YouTube processing failed:', errorMsg);
                return res.status(400).json({ error: errorMsg });
            }

            const info = result.data;
            const processedFormats = info.processedFormats || [];

            // Find the requested format
            const requestedFormat = processedFormats.find((f: any) => f.format_id === formatId);

            if (!requestedFormat) {
                console.error('Format not found:', formatId);
                return res.status(400).json({ error: 'Requested format not found' });
            }

            console.log('Found format:', {
                format_id: requestedFormat.format_id,
                hasUrl: !!requestedFormat.url,
                resolution: requestedFormat.resolution,
                hasAudio: requestedFormat.hasAudio
            });

            // Create a download endpoint that streams the file
            const downloadId = Buffer.from(`${url}-${requestedFormat.format_id}`).toString('base64').slice(0, 32);
            const filename = `${info.title}.${requestedFormat.ext}`.replace(/[^\w\s.-]/g, '_');

            // Store the download info temporarily (in production, use Redis or similar)
            global.pendingDownloads = global.pendingDownloads || new Map();
            global.pendingDownloads.set(downloadId, {
                url: requestedFormat.url,
                filename: filename,
                timestamp: Date.now(),
                // Audio merging info for video-only formats
                videoUrl: url,
                formatId: requestedFormat.format_id,
                hasAudio: requestedFormat.hasAudio,
                // Cookie support removed as session doesn't contain cookies
                // cookies: undefined
            });

            const downloadResponse = {
                success: true,
                downloadUrl: `/api/download-file/${downloadId}`,
                filename: filename
            };

            console.log('Sending download URL response');
            res.status(200).json(downloadResponse);
            return;
        }

        // Use server-side yt-dlp service to get video information
        const result = await getServerYouTubeVideoInfo(url);

        console.log('yt-dlp result:', { success: result.success, hasData: !!result.data, error: result.error });

        if (!result.success || !result.data) {
            const errorMsg = result.error || 'Failed to process video';
            console.error('YouTube processing failed:', errorMsg);

            // Provide guidance for yt-dlp-exec issues
            if (errorMsg.includes('command not found') || errorMsg.includes('ENOENT')) {
                return res.status(400).json({
                    error: 'YouTube downloader not available. yt-dlp-exec failed to initialize.',
                    solution: 'yt-dlp-exec should install automatically. Check network connectivity.',
                    details: errorMsg
                });
            }

            return res.status(400).json({ error: errorMsg });
        }

        const info = result.data;
        console.log('Video info extracted:', {
            title: info.title,
            uploader: info.uploader,
            hasThumbnail: !!info.thumbnail
        });

        // Process formats into video and audio categories
        const processedFormats = info.processedFormats || [];
        const videoFormats = processedFormats.filter((f: any) => f.hasVideo && !f.isAudioOnly);
        const audioFormats = processedFormats.filter((f: any) => f.isAudioOnly);

        console.log('Processed formats:', {
            total: processedFormats.length,
            video: videoFormats.length,
            audio: audioFormats.length
        });

        const response = {
            success: true,
            info: {
                id: url.includes('v=') ? url.split('v=')[1].split('&')[0] : 'unknown',
                title: info.title,
                thumbnail: info.thumbnail,
                uploader: info.uploader
            },
            videoFormats: videoFormats,
            audioFormats: audioFormats
        };

        console.log('Sending response:', { success: true, title: info.title });
        res.status(200).json(response);

    } catch (error: any) {
        console.error('Error in YouTube Downloader proxy:', error);
        res.status(500).json({
            error: 'An error occurred while processing your request. Please try again later.'
        });
    }
});

// Users API (logic from api/users.ts)
// FIX: Explicitly typing handlers resolves incorrect overload selection for `app.use`.
app.use('/api/users', usersRouter);

// Comments API (logic from api/comments.ts)
// FIX: Explicitly typing handlers resolves incorrect overload selection for `app.use`.
app.use('/api/comments', commentsRouter);

// Test endpoint for yt-dlp-exec functionality
app.get('/api/test-ytdlp', async (req: express.Request, res: express.Response) => {
    try {
        // Test yt-dlp-exec by getting info for a simple YouTube video
        const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // A simple "Hello World" video
        const result = await getServerYouTubeVideoInfo(testUrl);

        if (result.success && result.data) {
            res.json({
                success: true,
                message: 'yt-dlp-exec is working correctly',
                testVideoTitle: result.data.title,
                formatsCount: result.data.processedFormats?.length || 0
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Unknown error',
                message: 'yt-dlp-exec test failed'
            });
        }
    } catch (error: any) {
        console.error('yt-dlp-exec test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'yt-dlp-exec is not working properly'
        });
    }
});

// Progress tracking endpoint using Server-Sent Events
app.get('/api/download-progress/:downloadId', (req: express.Request, res: express.Response) => {
    const { downloadId } = req.params;

    // Set SSE headers with optimizations for real-time updates
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Transfer-Encoding': 'chunked'
    });

    // Disable response buffering for immediate updates
    if ((res as any).flush) (res as any).flush();

    // Send initial connection confirmation immediately
    res.write(`data: ${JSON.stringify({ stage: 'preparing', downloadId, progress: 0 })}\n\n`);
    if ((res as any).flush) (res as any).flush();

    // Store this connection for progress updates
    global.progressConnections = global.progressConnections || new Map();
    global.progressConnections.set(downloadId, res);

    // Set longer timeout for this connection
    req.setTimeout(40 * 60 * 1000); // 40 minutes

    console.log(`📡 Progress stream connected for download: ${downloadId}`);

    // Clean up on disconnect
    req.on('close', () => {
        console.log(`📡 Progress stream disconnected for download: ${downloadId}`);
        global.progressConnections.delete(downloadId);
    });

    req.on('error', (error) => {
        console.error(`📡 Progress stream error for ${downloadId}:`, error);
        global.progressConnections.delete(downloadId);
    });
});

// Helper function to send progress updates
function sendProgressUpdate(downloadId: string, progressData: any) {
    global.progressConnections = global.progressConnections || new Map();
    const connection = global.progressConnections.get(downloadId);
    if (connection) {
        try {
            connection.write(`data: ${JSON.stringify(progressData)}\n\n`);
        } catch (error) {
            // Connection might be closed, remove it
            global.progressConnections.delete(downloadId);
        }
    }
}

// File download endpoint that streams YouTube videos with proper headers
app.get('/api/download-file/:downloadId', async (req: express.Request, res: express.Response) => {
    try {
        const { downloadId } = req.params;

        // Retrieve download info
        global.pendingDownloads = global.pendingDownloads || new Map();
        const downloadInfo = global.pendingDownloads.get(downloadId);

        if (!downloadInfo) {
            return res.status(404).json({ error: 'Download link expired or not found' });
        }

        // Clean up expired downloads (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        if (downloadInfo.timestamp < oneHourAgo) {
            global.pendingDownloads.delete(downloadId);
            return res.status(404).json({ error: 'Download link expired' });
        }

        console.log('Streaming file:', downloadInfo.filename, '| hasAudio:', downloadInfo.hasAudio);

        // Track if download completed successfully
        let downloadCompleted = false;

        // Track temporary file for cleanup
        let tempFilePath = null;
        let ytDlpProcess = null;

        // Set very long timeout for large file downloads (2 hours for multi-GB files)
        req.setTimeout(120 * 60 * 1000);
        res.setTimeout(120 * 60 * 1000);

        // Handle client disconnection
        req.on('close', () => {
            if (!downloadCompleted) {
                console.log('🔌 Client disconnected during download');

                // Kill yt-dlp process if still running
                if (ytDlpProcess && !ytDlpProcess.killed) {
                    ytDlpProcess.kill();
                    console.log('🛑 Killed yt-dlp process due to client disconnect');
                }

                // Clean up temporary file if it exists
                if (tempFilePath) {
                    try {
                        unlinkSync(tempFilePath);
                        console.log('🧹 Cleaned up temp file after client disconnect');
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            }
        });

        // ALWAYS download video+audio separately and merge with FFmpeg HE-AAC
        // This ensures TV-compatible AAC LC SBR audio codec
        console.log('🎬 Starting download with HE-AAC encoding...');
        
        const tempOutputPath = path.join(tmpdir(), `yt-heaac-${downloadId}-${Date.now()}.mp4`);
        tempFilePath = tempOutputPath;


        // Use the helper function to download with HE-AAC encoding
        const result = await downloadYouTubeWithHEAAC(
            downloadInfo.videoUrl,
            downloadInfo.formatId,
            tempOutputPath,
            (progress) => sendProgressUpdate(downloadId, progress)
        );

        if (!result.success) {
            if (!res.headersSent) {
                res.status(500).json({ error: result.error || 'Download failed' });
            }
            return;
        }

        // Stream the completed file with HE-AAC audio
        const stats = statSync(tempOutputPath);
        const fileSize = stats.size;

        res.setHeader('Content-Length', fileSize.toString());
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.filename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        console.log('📤 Streaming HE-AAC encoded file:', downloadInfo.filename);

        const fileStream = createReadStream(tempOutputPath);

        fileStream.on('end', () => {
            downloadCompleted = true;
            console.log('✅ HE-AAC download completed successfully');
            
            // Clean up temp file
            try {
                if (existsSync(tempOutputPath)) {
                    unlinkSync(tempOutputPath);
                    console.log('🧹 Cleaned up temp file');
                }
            } catch (e) {}
        });

        fileStream.on('error', (streamError) => {
            console.error('File stream error:', streamError);
            try {
                if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);
            } catch (e) {}
            if (!res.finished) res.status(500).end();
        });

        fileStream.pipe(res);

    } catch (error: any) {
        console.error('Download streaming error:', error);
        res.status(500).json({ error: 'Failed to stream download' });
    }
});

// Test endpoint to trigger autonomous finder manually
app.post('/api/test-autonomous-finder', async (req: express.Request, res: express.Response) => {
    try {
        console.log('🧪 Manual test of autonomous finder triggered...');

        // Import the function dynamically to avoid circular imports
        const { processNextBatchForChannel } = await import('./bot/movieManager');

        // Mock bot for testing
        const testBot = {
            sendMessage: (userId: string, message: string) => {
                console.log('📨 [TEST BOT]:', message);
                return Promise.resolve();
            }
        };

        // Test with @itelediconstudio channel
        await processNextBatchForChannel('https://youtube.com/@itelediconstudio', testBot as any);

        res.json({
            success: true,
            message: 'Autonomous finder test completed. Check server logs for results.'
        });
    } catch (error: any) {
        console.error('❌ Autonomous finder test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Site Configuration API - serves siteConfig.json
app.get('/api/site-config', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const configPath = path.join(process.cwd(), 'data', 'siteConfig.json');

        // Check if file exists
        if (!fs.existsSync(configPath)) {
            console.error('Site config file not found at:', configPath);
            return res.status(404).json({ error: 'Site configuration not found' });
        }

        // Read and parse the file
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);

        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(config);
    } catch (error: any) {
        console.error('Error reading site config:', error);
        res.status(500).json({ error: 'Failed to load site configuration' });
    }
});

// Announcement API - serves announcement.json
app.get('/api/announcement', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const announcementPath = path.join(process.cwd(), 'data', 'announcement.json');

        // Check if file exists
        if (!fs.existsSync(announcementPath)) {
            console.error('Announcement file not found at:', announcementPath);
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Read and parse the file
        const announcementData = fs.readFileSync(announcementPath, 'utf8');
        const announcement = JSON.parse(announcementData);

        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(announcement);
    } catch (error: any) {
        console.error('Error reading announcement:', error);
        res.status(500).json({ error: 'Failed to load announcement' });
    }
});

// Movies API - serves movies.json
app.get('/api/movies', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const moviesPath = path.join(process.cwd(), 'data', 'movies.json');

        if (!fs.existsSync(moviesPath)) {
            console.error('Movies file not found at:', moviesPath);
            return res.status(404).json({ error: 'Movies data not found' });
        }

        const moviesData = fs.readFileSync(moviesPath, 'utf8');
        const movies = JSON.parse(moviesData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(movies);
    } catch (error: any) {
        console.error('Error reading movies:', error);
        res.status(500).json({ error: 'Failed to load movies' });
    }
});

// Actors API - serves actors.json
app.get('/api/actors', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const actorsPath = path.join(process.cwd(), 'data', 'actors.json');

        if (!fs.existsSync(actorsPath)) {
            console.error('Actors file not found at:', actorsPath);
            return res.status(404).json({ error: 'Actors data not found' });
        }

        const actorsData = fs.readFileSync(actorsPath, 'utf8');
        const actors = JSON.parse(actorsData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(actors);
    } catch (error: any) {
        console.error('Error reading actors:', error);
        res.status(500).json({ error: 'Failed to load actors' });
    }
});

// Collections API - serves collections.json
app.get('/api/collections', (req: express.Request, res: express.Response) => {
    try {
        const fs = require('fs');
        const collectionsPath = path.join(process.cwd(), 'data', 'collections.json');

        if (!fs.existsSync(collectionsPath)) {
            console.error('Collections file not found at:', collectionsPath);
            return res.status(404).json({ error: 'Collections data not found' });
        }

        const collectionsData = fs.readFileSync(collectionsPath, 'utf8');
        const collections = JSON.parse(collectionsData);

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        res.status(200).json(collections);
    } catch (error: any) {
        console.error('Error reading collections:', error);
        res.status(500).json({ error: 'Failed to load collections' });
    }
});


// --- STATIC FILE SERVING ---
// Use process.cwd() for production compatibility - __dirname points to dist/ in production
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, path) => {
    // Set Cache-Control headers to prevent caching in Replit iframe
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// SECURITY: Removed '/data' static serving to prevent exposure of sensitive JSON files
// Data files should be accessed through secure API endpoints only

// Serve the main app for any other route
// @FIX: Use express.Request and express.Response for proper type inference.
app.get('*', (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// --- STARTUP ---
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Web server listening on port ${PORT}. Accessible on all network interfaces.`);

    // Start the Telegram bot
    try {
        await runBot();
    } catch (error) {
        console.error("❌ Failed to start Telegram bot:", error);
    }
});