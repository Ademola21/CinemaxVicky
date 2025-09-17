// FIX: Changed import style to use `express.Request` and `express.Response` to resolve type conflicts.
import express from 'express';
import path from 'path';
import { runBot } from './bot/run';
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { validateSession } from './api/auth'; // Imported centralized auth validation
import usersRouter from './api/users';
import commentsRouter from './api/comments';

// --- SERVER SETUP ---
const app = express();
// FIX: Explicitly parse the port to a number to satisfy the listen() function's type requirement.
// Use Replit's PORT environment variable or default to 5000
const PORT = parseInt(process.env.PORT || '5000', 10);

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
        res.status(500).json({ error: 'Internal AI error: ' + error.message });
    }
});

// YouTube Downloader Proxy
// @FIX: Use express.Request and express.Response for proper type inference.
app.post('/api/youtube-downloader', async (req: express.Request, res: express.Response) => {
    const { spawn } = require('child_process');
    const { promisify } = require('util');
    
    try {
        const { url, session } = req.body;
        console.log('YouTube downloader request received with session:', session ? 'present' : 'missing');
        
        // Use the imported validateSession function
        if (!validateSession(session)) {
            console.log('Session validation failed for YouTube downloader');
            return res.status(401).json({ error: 'Unauthorized: You must be logged in to use this feature.' });
        }
        if (checkRateLimit(session.user.id).limited) {
            return res.status(429).json({ error: 'Too Many Requests.' });
        }
        if (!url || !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL.' });
        }

        // Use ytdl-core for cross-platform YouTube downloading
        const ytdl = require('ytdl-core');
        
        try {
            // Get video info using ytdl-core
            const info = await ytdl.getInfo(url);
            const videoDetails = info.videoDetails;
            
            // Extract available formats
            const formats = info.formats
                .filter((format: any) => format.url)
                .map((format: any) => ({
                    url: format.url,
                    quality: format.qualityLabel || format.audioBitrate || 'unknown',
                    format: format.container?.toUpperCase() || 'MP4',
                    audio: format.hasAudio,
                    video: format.hasVideo,
                    type: !format.hasVideo ? 'audio' : (!format.hasAudio ? 'video' : 'video+audio')
                }))
                .slice(0, 20); // Limit to 20 options
            
            // Find the best format (with both audio and video)
            const bestFormat = formats.find((f: any) => f.audio && f.video) || formats[0];
            
            // Get thumbnail
            const thumbnail = videoDetails.thumbnails?.find((t: any) => t.width >= 640) || 
                            videoDetails.thumbnails?.[videoDetails.thumbnails.length - 1];

            const response = {
                status: 'success',
                title: videoDetails.title || 'Unknown Title',
                author: videoDetails.author?.name || videoDetails.ownerChannelName || 'Unknown Channel',
                thumbnail: thumbnail?.url || '',
                url: bestFormat?.url || '',
                picker: formats
            };

            res.status(200).json(response);
            
        } catch (ytdlError: any) {
            console.error('ytdl-core error:', ytdlError);
            
            // Handle common ytdl-core errors
            if (ytdlError.message?.includes('Video unavailable') || ytdlError.message?.includes('private')) {
                return res.status(400).json({ 
                    error: 'This video is unavailable, private, or age-restricted.' 
                });
            } else if (ytdlError.message?.includes('copyright')) {
                return res.status(400).json({ 
                    error: 'This video is not available due to copyright restrictions.' 
                });
            } else {
                return res.status(500).json({ 
                    error: 'Failed to process this video. Please try again later.' 
                });
            }
        }

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