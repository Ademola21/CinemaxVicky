// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { Movie } from './types';
import { setUserState, getUserState, clearUserState, atomicWrite } from './utils';
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { Buffer } from 'buffer';
import { URL } from 'url';
import { BlobServiceClient } from '@azure/storage-blob';
import { getYouTubeVideoInfo, isValidYouTubeURL } from './youtubeService';

const MOVIES_PATH = path.join(process.cwd(), 'data/movies.json');
const POSTERS_DIR = path.join(process.cwd(), 'public/posters');
// PROGRESS_PATH removed - checking against website movies directly now

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'media';
const CDN_BASE_URL = process.env.CDN_BASE_URL;

let blobServiceClient: BlobServiceClient | null = null;
if (AZURE_STORAGE_CONNECTION_STRING) {
    try {
        blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        console.log('✅ Azure Blob Storage client initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Azure Blob Storage client:', error);
    }
} else {
    console.log('⚠️ Azure Storage connection string not found. Using local storage for posters.');
}

// --- Azure OpenAI Client Setup ---
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

if (!azureEndpoint || !azureApiKey || !azureDeploymentName) {
    console.error("Azure OpenAI environment variables are not set. Bot AI features will be disabled.");
}
const client = azureEndpoint && azureApiKey ? new OpenAIClient(azureEndpoint, new AzureKeyCredential(azureApiKey)) : null;
// ---

// Helper to read movies from the JSON file
const readMovies = (): Movie[] => {
    try {
        console.log('🔍 Trying to read movies from:', MOVIES_PATH);
        if (!fs.existsSync(MOVIES_PATH)) {
            console.log('❌ Movies file does not exist at:', MOVIES_PATH);
            return [];
        }
        const data = fs.readFileSync(MOVIES_PATH, 'utf-8');
        const movies = JSON.parse(data);
        console.log(`✅ Successfully read ${movies.length} movies from file`);
        return movies;
    } catch (error) {
        console.error("❌ Error reading movies.json:", error);
        console.error('   File path:', MOVIES_PATH);
        console.error('   Working directory:', process.cwd());
        return [];
    }
};
const writeMovies = (movies: Movie[]) => atomicWrite(MOVIES_PATH, JSON.stringify(movies, null, 2));

// Progress file system removed - now checking against website movies directly like your Python script

const invokeAzureAI = async (systemInstruction: string, userPrompt: string, max_tokens: number = 2048): Promise<any> => {
    if (!client) {
        throw new Error("Azure AI service is not configured.");
    }

    const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
    ];

    // FIX: Corrected variable name from 'maxTokens' to 'max_tokens' to match function parameter.
    const result = await client.getChatCompletions(azureDeploymentName!, messages, { maxTokens: max_tokens });

    // Extract JSON from AI response, handling markdown code blocks
    let content = result.choices[0].message?.content || '{}';

    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        content = jsonMatch[1].trim();
    }

    // Parse the JSON
    return JSON.parse(content);
};

const sanitizeForFilename = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[\s\W]/g, '-') // Replace whitespace and non-word chars with a hyphen
        .replace(/-+/g, '-')     // Collapse consecutive hyphens
        .replace(/^-|-$/g, '')   // Trim leading/trailing hyphens
        .slice(0, 50);           // Truncate to a reasonable length
};

// Helper function to detect content type from buffer
const detectContentType = (buffer: Buffer, fileName: string): string => {
    // Check magic bytes for common image formats
    const firstBytes = buffer.slice(0, 12);
    
    // WebP: RIFF....WEBP
    if (firstBytes.slice(0, 4).toString() === 'RIFF' && firstBytes.slice(8, 12).toString() === 'WEBP') {
        return 'image/webp';
    }
    
    // PNG: 89504E47
    if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
        return 'image/png';
    }
    
    // JPEG: FFD8FF
    if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
        return 'image/jpeg';
    }
    
    // GIF: 474946
    if (firstBytes.slice(0, 3).toString() === 'GIF') {
        return 'image/gif';
    }
    
    // Fallback to filename extension
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.webp': return 'image/webp';
        case '.png': return 'image/png';
        case '.gif': return 'image/gif';
        case '.jpg':
        case '.jpeg':
        default: return 'image/jpeg';
    }
};

// Helper function to normalize CDN URL building
const buildCdnUrl = (baseUrl: string, fileName: string): string => {
    // Ensure baseUrl ends with slash, fileName doesn't start with slash
    const normalizedBase = baseUrl.replace(/\/$/, '') + '/';
    const normalizedFileName = fileName.replace(/^\/+/, '');
    
    // URL encode the filename to handle special characters
    const encodedFileName = encodeURIComponent(normalizedFileName);
    
    return normalizedBase + encodedFileName;
};

// Helper function to extract filename from CDN URL
const extractFileNameFromCdnUrl = (cdnUrl: string, baseUrl: string): string => {
    // Remove the base URL and decode the filename
    const normalizedBase = baseUrl.replace(/\/$/, '') + '/';
    
    if (!cdnUrl.startsWith(normalizedBase)) {
        throw new Error(`URL ${cdnUrl} does not start with expected base ${normalizedBase}`);
    }
    
    const encodedFileName = cdnUrl.substring(normalizedBase.length);
    return decodeURIComponent(encodedFileName);
};

// Upload image to Azure Blob Storage
const uploadToAzureBlob = async (imageBuffer: Buffer, fileName: string): Promise<string | null> => {
    if (!blobServiceClient) {
        console.log('Azure Blob Storage not configured, falling back to local storage');
        return null;
    }

    try {
        const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        
        // Detect actual content type from buffer and filename
        const contentType = detectContentType(imageBuffer, fileName);
        console.log(`📄 Detected content type: ${contentType} for file: ${fileName}`);
        
        // Upload the image buffer with detected content type
        await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        });

        // Return CDN URL if configured, otherwise return direct blob URL
        if (CDN_BASE_URL) {
            const cdnUrl = buildCdnUrl(CDN_BASE_URL, fileName);
            console.log(`✅ Image uploaded to Azure, serving via CDN: ${cdnUrl}`);
            return cdnUrl;
        } else {
            console.log(`✅ Image uploaded to Azure: ${blockBlobClient.url}`);
            return blockBlobClient.url;
        }
    } catch (error) {
        console.error('Error uploading to Azure Blob Storage:', error);
        return null;
    }
};

// Delete image from Azure Blob Storage
const deleteFromAzureBlob = async (blobUrl: string): Promise<boolean> => {
    if (!blobServiceClient) {
        console.log('Azure Blob Storage not configured, cannot delete from Azure');
        return false;
    }

    try {
        let fileName: string;
        
        console.log(`🗑️ Attempting to delete blob from URL: ${blobUrl}`);
        
        // Handle both CDN URLs and direct blob URLs
        if (CDN_BASE_URL && blobUrl.startsWith(CDN_BASE_URL)) {
            // Extract filename from CDN URL using helper function
            try {
                fileName = extractFileNameFromCdnUrl(blobUrl, CDN_BASE_URL);
                console.log(`📄 Extracted filename from CDN URL: ${fileName}`);
            } catch (error) {
                console.error('Error extracting filename from CDN URL:', error);
                return false;
            }
        } else {
            // Extract filename from direct Azure blob URL
            try {
                const url = new URL(blobUrl);
                fileName = path.basename(url.pathname);
                // Decode any URL encoding in the filename
                fileName = decodeURIComponent(fileName);
                console.log(`📄 Extracted filename from direct blob URL: ${fileName}`);
            } catch (error) {
                console.error('Error parsing direct blob URL:', error);
                return false;
            }
        }
        
        if (!fileName || fileName.trim() === '') {
            console.error('❌ Could not extract valid filename from URL');
            return false;
        }
        
        const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        
        // Use deleteIfExists to avoid errors if blob doesn't exist
        const deleteResponse = await blockBlobClient.deleteIfExists();
        
        if (deleteResponse.succeeded) {
            console.log(`✅ Deleted from Azure Blob Storage: ${fileName}`);
            return true;
        } else {
            console.log(`⚠️ Blob ${fileName} did not exist (already deleted or never existed)`);
            return true; // Still consider this success since the goal is achieved
        }
    } catch (error) {
        console.error('Error deleting from Azure Blob Storage:', error);
        return false;
    }
};


// --- ADD MOVIE FLOW ---

export const startAddMovieFlow = (bot: TelegramBot, chatId: number, messageId: number) => {
    bot.editMessageText("How would you like to add this movie?", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔗 From YouTube URL", callback_data: "add_movie_youtube" }],
                [{ text: "📝 Manually (Cinema)", callback_data: "add_movie_manual" }]
            ]
        }
    });
};

// --- MANUAL (CINEMA) MOVIE FLOW ---
const manualAddMovieSteps = [
    { key: 'title', prompt: "What is the movie's title?" },
    { key: 'description', prompt: "Please provide a short description, or type 'AI' to generate one." },
    { key: 'genre', prompt: "What is the genre? (e.g., Fantasy, Action)" },
    { key: 'category', prompt: "What is the category? (Drama, Comedy, Action, Romance, Thriller, Epic)" },
    { key: 'releaseDate', prompt: "What is the release date? (YYYY-MM-DD)" },
    { key: 'stars', prompt: "Who are the main stars? (Comma-separated, e.g., Femi Adebayo, Bimbo Ademoye)" },
    { key: 'runtime', prompt: "What is the runtime? (e.g., 2h 14m)" },
    { key: 'rating', prompt: "What is the rating? (A number from 1 to 10, e.g., 8.9)" },
    { key: 'trailerId', prompt: "What is the YouTube trailer ID? (Optional, send 'skip' if none)" },
    { key: 'downloadLink', prompt: "Enter the download URL for this cinema movie." },
    { key: 'poster', prompt: "Please send the movie poster image." },
];

export const startManualAddFlow = (bot: TelegramBot, chatId: number) => {
    const userId = chatId;
    setUserState(userId, {
        command: 'add_movie_manual',
        step: 0,
        movieData: {}
    });
    bot.sendMessage(chatId, `Let's add a new cinema movie. ${manualAddMovieSteps[0].prompt}`);
};

// --- YOUTUBE MOVIE FLOW ---
export const startYouTubeAddFlow = (bot: TelegramBot, chatId: number) => {
    const userId = chatId;
    setUserState(userId, { command: 'add_movie_youtube_url' });
    bot.sendMessage(chatId, "Please send the full YouTube video URL for the movie.");
};

// --- UNIVERSAL RESPONSE HANDLER ---
export const handleAddMovieResponse = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId) return;

    const state = getUserState(userId);
    if (!state || !state.command.startsWith('add_movie')) return;

    if (state.command.startsWith('add_movie_manual')) {
        await handleManualMovieResponse(bot, msg);
    } else if (state.command.startsWith('add_movie_youtube')) {
        await handleYouTubeMovieResponse(bot, msg);
    }
};

const handleManualMovieResponse = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const state = getUserState(userId)!;
    const currentStep = manualAddMovieSteps[state.step!];

    if (currentStep.key === 'poster') {
        if (!msg.photo) {
            bot.sendMessage(userId, "That doesn't look like an image. Please send the poster.");
            return;
        }
        try {
            await bot.sendChatAction(userId, 'upload_photo');
            const posterPath = await savePoster(bot, msg, state.movieData.title);
            state.movieData.poster = posterPath;
            state.movieData.id = sanitizeForFilename(state.movieData.title);
        } catch (error) {
            console.error("Error saving poster:", error);
            bot.sendMessage(userId, "Sorry, there was an error saving the poster. Please try again.");
            return;
        }
    } else {
        if (!msg.text) {
             bot.sendMessage(userId, "Invalid input. Please provide the requested information.");
             return;
        }
        if (currentStep.key === 'description' && msg.text.toLowerCase() === 'ai') {
            await bot.sendChatAction(userId, 'typing');
            try {
                const system = "You are an expert movie summarizer. Based on the title, generate a compelling, single-paragraph movie description of 40-50 words. Respond ONLY with the description text, no extra conversational text.";
                const prompt = `Yoruba movie title: "${state.movieData.title}"`;
                const response = await invokeAzureAI(system, prompt);
                const desc = response.description;
                state.movieData.description = desc;
                bot.sendMessage(userId, `🤖 AI Generated Description:\n\n_"${desc}"_`);
            } catch (e) {
                bot.sendMessage(userId, "AI failed to generate a description. Please enter one manually.");
                return;
            }
        } else if (msg.text.toLowerCase() === 'skip' && currentStep.key === 'trailerId') {
            state.movieData[currentStep.key] = undefined;
        } else {
            state.movieData[currentStep.key] = msg.text;
        }
    }

    const nextStepIndex = state.step! + 1;
    if (nextStepIndex < manualAddMovieSteps.length) {
        state.step = nextStepIndex;
        setUserState(userId, state);
        setTimeout(() => bot.sendMessage(userId, manualAddMovieSteps[nextStepIndex].prompt), 500);
    } else {
        const movies = readMovies();
        if (movies.find(m => m.title.toLowerCase() === state.movieData.title.toLowerCase())) {
            bot.sendMessage(userId, `❌ Error! A movie titled "${state.movieData.title}" already exists.`);
            clearUserState(userId);
            return;
        }
        const newMovie: Movie = {
            id: state.movieData.id,
            title: state.movieData.title,
            poster: state.movieData.poster,
            downloadLink: state.movieData.downloadLink,
            genre: state.movieData.genre,
            category: state.movieData.category,
            releaseDate: state.movieData.releaseDate,
            stars: state.movieData.stars.split(',').map((s: string) => s.trim()),
            runtime: state.movieData.runtime,
            rating: parseFloat(state.movieData.rating),
            description: state.movieData.description,
            trailerId: state.movieData.trailerId,
            popularity: 70, 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            seriesTitle: state.movieData.title, // Assume manual adds are part 1
            partNumber: 1
        };
        writeMovies([...movies, newMovie]);
        bot.sendMessage(userId, `✅ Success! Movie "${newMovie.title}" has been added.`);
        clearUserState(userId);
    }
};

const getBestThumbnail = (thumbnails: any): string | null => {
    if (!thumbnails) return null;
    return thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.standard?.url || null;
};

const parseDuration = (duration: string): number => {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) return 0;
    const hours = parseInt(matches[1] || '0');
    const minutes = parseInt(matches[2] || '0');
    return (hours * 60) + minutes;
};


const fetchYouTubeVideoDetails = async (videoUrl: string): Promise<any | null> => {
    if (!isValidYouTubeURL(videoUrl)) return null;
    
    try {
        const result = await getYouTubeVideoInfo(videoUrl);
        if (!result.success || !result.data) {
            console.error("Error fetching from yt-dlp:", result.error);
            return null;
        }

        const info = result.data;
        
        // Convert yt-dlp format to YouTube API format for compatibility
        return {
            snippet: {
                title: info.title,
                description: info.description || '',
                publishedAt: new Date().toISOString(), // yt-dlp doesn't provide this easily
                thumbnails: {
                    maxres: { url: info.thumbnail },
                    high: { url: info.thumbnail },
                    medium: { url: info.thumbnail },
                    standard: { url: info.thumbnail }
                }
            },
            contentDetails: {
                duration: info.duration ? `PT${Math.floor(info.duration / 60)}M${info.duration % 60}S` : 'PT0S'
            }
        };
    } catch (error) {
        console.error("Error fetching from yt-dlp:", error);
        return null;
    }
};

const aiEnrichmentSystemInstruction = `You are an expert AI for cataloging Yoruba movies from YouTube data. Your task is to extract, clean, and format movie details precisely.
Analyze the provided YouTube title and description.
The YouTube title often contains junk like "LATEST YORUBA MOVIE 2024". REMOVE this junk. The final title must be the official movie title only.
Respond ONLY with a single, valid JSON object with the following fields:
- "title": The clean, official movie title. If the title indicates it's a sequel (e.g., "Ololade Part 2", "Koleoso 2"), the title MUST include "Part X".
- "seriesTitle": The base name of the movie series. For "Koleoso Part 2", this would be "Koleoso". If it's not a series (e.g., "Anikulapo"), this field must be the same as the "title" field.
- "partNumber": The part number as an integer. If it's the first or only part, this MUST be 1. For "Koleoso Part 2", this MUST be 2.
- "description": A compelling 30-40 word summary of the movie based on the provided description.
- "stars": An array of the top 3-4 main actors mentioned.
- "genre": A single primary genre that best fits the movie (e.g., "Drama", "Action", "Epic", "Thriller").
- "category": Choose the best fit from this exact list: 'Drama', 'Comedy', 'Action', 'Romance', 'Thriller', 'Epic'.`;

const handleYouTubeMovieResponse = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const userId = msg.from!.id;
    const state = getUserState(userId)!;
    const extractVideoId = (url: string): string | null => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    };

    if (state.command === 'add_movie_youtube_url') {
        const url = msg.text;
        const videoId = extractVideoId(url!);
        if (!url || !videoId) {
            bot.sendMessage(userId, "That doesn't look like a valid YouTube URL. Please try again.");
            return;
        }

        bot.sendMessage(userId, "⏳ Fetching video details with yt-dlp... The AI will then arrange and correct the metadata.");
        await bot.sendChatAction(userId, 'typing');

        const videoDetails = await fetchYouTubeVideoDetails(url);
        if (!videoDetails) {
            bot.sendMessage(userId, "Could not fetch details for this YouTube URL. It might be invalid, private, or unavailable.");
            clearUserState(userId);
            return;
        }
        const { title, description, publishedAt } = videoDetails.snippet;
        const durationMinutes = parseDuration(videoDetails.contentDetails.duration);

        if (durationMinutes < 15) {
             bot.sendMessage(userId, `⚠️ This video is only ${durationMinutes} minutes long. It's likely a trailer. The movie has NOT been added. Please provide a link to the full movie.`);
             clearUserState(userId);
             return;
        }

        const thumbnailUrl = getBestThumbnail(videoDetails.snippet.thumbnails);
        if (!thumbnailUrl) {
            bot.sendMessage(userId, "Could not find a thumbnail for this video. Cannot proceed.");
            clearUserState(userId);
            return;
        }

        try {
            const userPrompt = `Enrich this movie data. YouTube Title: "${title}". YouTube Description: "${description}"`;

            const details = await invokeAzureAI(aiEnrichmentSystemInstruction, userPrompt);
            const posterPath = await downloadImage(thumbnailUrl, details.title);
            if (!posterPath) throw new Error("Failed to download thumbnail.");

            const movies = readMovies();
            if (movies.find(m => m.title.toLowerCase() === details.title.toLowerCase())) {
                bot.sendMessage(userId, `❌ Error! A movie titled "${details.title}" already exists.`);
                clearUserState(userId);
                return;
            }

            const newMovie: Movie = {
                id: sanitizeForFilename(details.title),
                title: details.title, poster: posterPath,
                downloadLink: url, genre: details.genre,
                category: details.category, releaseDate: publishedAt,
                stars: details.stars, runtime: `${durationMinutes}m`, rating: 7.0,
                description: details.description, popularity: 75,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                seriesTitle: details.seriesTitle,
                partNumber: details.partNumber
            };

            // NEW: Confirmation Step
            setUserState(userId, { command: 'add_movie_youtube_confirm', movieData: newMovie });
            const caption = `*Confirm Movie Details*\n\n` +
                `*Title:* ${newMovie.title}\n` +
                `*Series:* ${newMovie.seriesTitle} (Part ${newMovie.partNumber})\n` +
                `*Description:* ${newMovie.description}\n` +
                `*Stars:* ${newMovie.stars.join(', ')}\n` +
                `*Genre:* ${newMovie.genre} | *Category:* ${newMovie.category}\n\n` +
                `Do you want to add this movie to the site?`;

            // Check if posterPath is a URL (Azure) or local path
            const photoSource = posterPath.startsWith('http') ? posterPath : path.join(__dirname, '../public', posterPath);

            bot.sendPhoto(userId, photoSource, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Accept", callback_data: "youtube_movie_accept" }, { text: "❌ Reject", callback_data: "youtube_movie_reject" }]
                    ]
                }
            });

        } catch (e) {
            console.error(e);
            bot.sendMessage(userId, "❌ The AI failed to process this URL. Please try a different one or add the movie manually.");
            clearUserState(userId);
        }
    }
};

export const handleYouTubeConfirmation = async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const userId = query.from.id;
    const state = getUserState(userId);

    if (!state || state.command !== 'add_movie_youtube_confirm') {
        bot.answerCallbackQuery(query.id, { text: "This action has expired." });
        return;
    }

    const { movieData } = state;
    const action = query.data;

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: query.message?.chat.id,
        message_id: query.message?.message_id
    });

    if (action === 'youtube_movie_accept') {
        const movies = readMovies();
        movies.push(movieData);
        writeMovies(movies);
        bot.sendMessage(userId, `✅ Success! Movie "${movieData.title}" has been added.`);
    } else { // Reject
        try {
            // Handle both Azure blob URLs and local file paths when rejecting movie
            if (movieData.poster.startsWith('http')) {
                // It's an Azure blob URL
                await deleteFromAzureBlob(movieData.poster);
            } else if (movieData.poster.startsWith('/posters/')) {
                // It's a local file path
                const posterToDelete = path.join(__dirname, '../public', movieData.poster);
                if (fs.existsSync(posterToDelete)) {
                    fs.unlinkSync(posterToDelete);
                    console.log(`✅ Deleted rejected local poster: ${posterToDelete}`);
                }
            }
        } catch (error) {
            console.error("Could not delete rejected poster:", error);
        }
        bot.sendMessage(userId, `❌ Operation cancelled. The movie "${movieData.title}" has been discarded.`);
    }

    clearUserState(userId);
    bot.answerCallbackQuery(query.id);
};

async function savePoster(bot: TelegramBot, msg: TelegramBot.Message, title: string): Promise<string> {
    const largestPhoto = msg.photo![msg.photo!.length - 1];
    const fileId = largestPhoto.file_id;
    
    const movieId = sanitizeForFilename(title || `movie-${Date.now()}`);
    const posterFileName = `${movieId}-${Date.now()}.jpg`;

    // Get the image as a buffer
    const fileLink = await bot.getFileLink(fileId);
    const response = await fetch(fileLink);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Try to upload to Azure first
    const azureUrl = await uploadToAzureBlob(imageBuffer, posterFileName);
    if (azureUrl) {
        console.log(`✅ Poster uploaded to Azure: ${azureUrl}`);
        return azureUrl;
    }

    // Fallback to local storage
    if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });
    const posterPath = path.join(POSTERS_DIR, posterFileName);
    fs.writeFileSync(posterPath, imageBuffer);
    console.log(`📁 Poster saved locally: ${posterPath}`);
    return `/posters/${posterFileName}`;
}

// --- AUTONOMOUS MOVIE CREATION ---

async function downloadImage(url: string, title: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) throw new Error(`URL is not a direct image link.`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const movieId = sanitizeForFilename(title);
        const pathname = new URL(url).pathname;
        const extension = path.extname(pathname) || '.jpg';
        const posterFileName = `${movieId}-${Date.now()}${extension}`;

        // Try to upload to Azure first
        const azureUrl = await uploadToAzureBlob(buffer, posterFileName);
        if (azureUrl) {
            console.log(`✅ Poster uploaded to Azure: ${azureUrl}`);
            return azureUrl;
        }

        // Fallback to local storage
        if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });
        const posterPath = path.join(POSTERS_DIR, posterFileName);
        fs.writeFileSync(posterPath, buffer);
        console.log(`📁 Poster saved locally: ${posterPath}`);
        return `/posters/${posterFileName}`;
    } catch (error) {
        console.error(`Error downloading image for "${title}" from ${url}:`, error);
        return null;
    }
}

export const createMovieFromYouTube = async (videoDetails: any): Promise<Movie | null> => {
    try {
        const { title, description, thumbnails, publishedAt } = videoDetails.snippet;
        const durationMinutes = parseDuration(videoDetails.contentDetails.duration);
        const thumbnailUrl = getBestThumbnail(thumbnails);

        if (!thumbnailUrl) {
            console.log(`Autonomous Finder: No thumbnail found for "${title}".`);
            return null;
        }

        const userPrompt = `Enrich this movie data. YouTube Title: "${title}". YouTube Description: "${description}"`;

        const details = await invokeAzureAI(aiEnrichmentSystemInstruction, userPrompt);
        const posterLocalPath = await downloadImage(thumbnailUrl, details.title);
        if (!posterLocalPath) return null;

        const newMovie: Movie = {
            id: sanitizeForFilename(details.title) + `-${Date.now().toString().slice(-4)}`,
            title: details.title, poster: posterLocalPath,
            downloadLink: `https://www.youtube.com/watch?v=${videoDetails.id}`,
            genre: details.genre, category: details.category, releaseDate: publishedAt,
            stars: details.stars, runtime: `${durationMinutes}m`,
            rating: 7.0 + parseFloat((Math.random() * 2).toFixed(1)),
            description: details.description,
            popularity: 70 + Math.floor(Math.random() * 15),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            seriesTitle: details.seriesTitle,
            partNumber: details.partNumber,
        };
        return newMovie;

    } catch (error) {
        console.error("AI processing or poster download failed:", error);
        return null;
    }
};

const getChannelIdFromUrl = async (channelUrl: string): Promise<string | null> => {
    const handleMatch = channelUrl.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
    const idMatch = channelUrl.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);

    if (idMatch) return idMatch[1];
    if (!handleMatch) return null;

    const handle = handleMatch[1];
    try {
        // Use channels endpoint with forHandle like your Python script
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return data.items[0].id;
        }
        
        // Fallback to search if forHandle doesn't work
        const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${handle}&type=channel&key=${YOUTUBE_API_KEY}`);
        const searchData = await searchResponse.json();
        if (searchData.items && searchData.items.length > 0) {
            const foundChannel = searchData.items.find((item: any) => item.snippet.channelTitle.toLowerCase() === handle.toLowerCase() || item.snippet.customUrl === `@${handle}`);
            return foundChannel ? foundChannel.snippet.channelId : searchData.items[0].snippet.channelId;
        }
        return null;
    } catch (e) {
        console.error("Failed to resolve channel handle:", e);
        return null;
    }
};


const getChannelUploadsPlaylistId = async (channelId: string): Promise<string | null> => {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
    } catch (e) {
        console.error("Failed to get uploads playlist ID:", e);
        return null;
    }
};


// Function that works exactly like your Python script - gets ALL videos and processes from newest to oldest
const getAllChannelVideos = async (channelId: string): Promise<any[]> => {
    const videos: any[] = [];
    let pageToken: string | undefined = undefined;
    
    while (true) {
        let url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video`;
        if (pageToken) {
            url += `&pageToken=${pageToken}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.items) break;
        
        for (const item of data.items) {
            videos.push({
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description || ""
            });
        }
        
        pageToken = data.nextPageToken;
        if (!pageToken) break;
    }
    
    return videos;
};

const getVideoDetailsBatch = async (videoIds: string[]): Promise<Record<string, any>> => {
    const details: Record<string, any> = {};
    
    // Process in batches of 50 (YouTube API limit)
    for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const ids = batch.join(',');
        const url = `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${ids}&part=contentDetails,snippet`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        for (const item of data.items || []) {
            const vid = item.id;
            const duration = parseDuration(item.contentDetails.duration);
            details[vid] = {
                duration: duration,
                category: item.snippet.categoryId || "Unknown",
                description: item.snippet.description || "",
                videoDetails: item // Store the full video details for createMovieFromYouTube
            };
        }
    }
    
    return details;
};

export const processNextBatchForChannel = async (channelUrl: string, bot: TelegramBot) => {
    const adminId = process.env.ADMIN_TELEGRAM_USER_ID!;
    console.log(`🚀 Starting FAST channel processing for: ${channelUrl}`);

    try {
        // Use yt-dlp with extract-flat for ultra-fast processing (like your Python code)
        console.log('📹 Using yt-dlp extract-flat for fast channel processing...');
        
        const args = [
            '--flat-playlist',
            '--dump-single-json',
            '--no-warnings',
            '--skip-download'
        ];
        
        // Add cookies if available
        const { ytdlpManager } = require('../services/ytdlpBinaryManager');
        const cookiePath = ytdlpManager.getCookieFilePath();
        if (cookiePath) {
            args.push('--cookies', cookiePath);
            console.log('🍪 Using cookies for fast channel processing');
        }
        
        const output = await ytdlpManager.execute([...args, channelUrl]);
        const channelInfo = JSON.parse(output);
        const videos = channelInfo.entries || [];
        
        console.log(`🎬 Found ${videos.length} videos using fast yt-dlp extraction`);
        
        if (videos.length === 0) {
            bot.sendMessage(adminId, `✅ No videos found on channel: ${channelUrl}`);
            return;
        }
        
        bot.sendMessage(adminId, `🔄 Processing ${videos.length} videos with fast approach...`);

        // Get existing movies to check against (like your Python script checks website)
        const currentMovies = readMovies();
        const existingTitles = new Set(currentMovies.map(m => m.title.toLowerCase()));

        let newMoviesAdded = 0;
        let trailersSkipped = 0;
        let duplicatesSkipped = 0;

        // Process videos from newest to oldest (they come in chronological order)
        for (const video of videos) {
            const videoId = video.id;
            const title = video.title;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            console.log(`📺 Processing: ${title}`);
            
            // Generate fast thumbnail URL using your approach
            const { getBestThumbnailUrl } = require('./youtubeService');
            const fastThumbnail = getBestThumbnailUrl(videoId);
            
            console.log(`🖼️ Generated fast thumbnail: ${fastThumbnail}`);
            
            // Skip trailers by title analysis (faster than getting duration)
            const titleLower = title.toLowerCase();
            if (titleLower.includes('trailer') || titleLower.includes('teaser') || 
                titleLower.includes('preview') || titleLower.includes('coming soon')) {
                console.log(`Skipping trailer by title: ${title}`);
                trailersSkipped++;
                continue;
            }
            
            try {
                // Use AI to process the video info with fast thumbnail
                const userPrompt = `Enrich this movie data. YouTube Title: "${title}". YouTube Description: "${video.description || ''}"`;
                const details = await invokeAzureAI(aiEnrichmentSystemInstruction, userPrompt);
                
                // Check against existing movies on website (like your Python script)
                if (existingTitles.has(details.title.toLowerCase())) {
                    console.log(`Skipped duplicate: ${details.title} already exists on website`);
                    duplicatesSkipped++;
                    continue;
                }
                
                // Create movie with fast thumbnail URL (no downloading needed!)
                const newMovie: Movie = {
                    id: sanitizeForFilename(details.title) + `-${Date.now().toString().slice(-4)}`,
                    title: details.title,
                    poster: fastThumbnail, // Use fast thumbnail URL directly!
                    downloadLink: videoUrl,
                    genre: details.genre,
                    category: details.category,
                    releaseDate: new Date().toISOString().split('T')[0],
                    stars: details.stars,
                    runtime: 'Unknown', // We don't get duration in extract-flat mode
                    rating: 7.0 + parseFloat((Math.random() * 2).toFixed(1)),
                    description: details.description,
                    popularity: 70 + Math.floor(Math.random() * 15),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    seriesTitle: details.seriesTitle,
                    partNumber: details.partNumber,
                };
                
                currentMovies.push(newMovie);
                existingTitles.add(newMovie.title.toLowerCase());
                
                console.log(`✅ Fast-added: ${newMovie.title}`);
                bot.sendMessage(adminId, `✅ Added: "${newMovie.title}" with fast thumbnail`);
                newMoviesAdded++;
                
            } catch (error) {
                console.error(`AI processing failed for: ${title}`, error);
            }
        }

        // Save all new movies
        if (newMoviesAdded > 0) {
            writeMovies(currentMovies);
        }

        // Send comprehensive summary like your Python script
        const summary = `✅ FAST channel processing completed for ${channelUrl}\n\n` +
                       `📊 Results:\n` +
                       `• Total videos processed: ${videos.length}\n` +
                       `• New movies added: ${newMoviesAdded}\n` +
                       `• Trailers skipped: ${trailersSkipped}\n` +
                       `• Duplicates skipped: ${duplicatesSkipped}\n\n` +
                       `🚀 All thumbnails use fast YouTube CDN URLs!`;
        
        bot.sendMessage(adminId, summary);
        console.log(summary);

    } catch (e) {
        console.error(`Error in fast processing for ${channelUrl}:`, e);
        bot.sendMessage(adminId, `🚨 Fast processing error for ${channelUrl}: ${e}`);
    }
};


// --- INLINE MOVIE SEARCH (NEW) ---
export const handleInlineMovieSearch = async (bot: TelegramBot, query: TelegramBot.InlineQuery) => {
    const searchQuery = query.query.toLowerCase().trim();
    const baseUrl = process.env.WEBSITE_BASE_URL;

    if (!baseUrl) {
        console.warn('⚠️ WEBSITE_BASE_URL environment variable is not set. Inline search poster images will not work.');
    }

    if (!searchQuery) {
        // Answer with an empty array if the query is empty.
        // Telegram will then show the user's history or nothing.
        await bot.answerInlineQuery(query.id, []);
        return;
    }

    const movies = readMovies();
    const results = movies.filter(movie => movie.title.toLowerCase().includes(searchQuery));

    const inlineResults: TelegramBot.InlineQueryResultPhoto[] = results.slice(0, 20).map(movie => {
        const caption = `*${movie.title}*\n\n` +
            `*Description:* ${movie.description.substring(0, 150)}...\n\n` +
            `*Genre:* ${movie.genre} | *Category:* ${movie.category}\n` +
            `*Rating:* ${movie.rating} ⭐ | *Runtime:* ${movie.runtime}\n` +
            `*Stars:* ${movie.stars.join(', ')}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "✏️ Edit Movie", callback_data: `edit_movie_start_${movie.id}` }, { text: "🗑️ Delete Movie", callback_data: `delete_movie_confirm_${movie.id}` }]
            ]
        };

        const posterUrl = movie.poster.startsWith('http') ? movie.poster : `${baseUrl || ''}${movie.poster}`;

        return {
            type: 'photo',
            id: movie.id,
            photo_url: posterUrl,
            thumb_url: posterUrl,
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        };
    });

    await bot.answerInlineQuery(query.id, inlineResults, {
        cache_time: 10 // Cache results for 10 seconds
    });
};


// --- EDIT FLOWS (NEW) ---

async function displayEditMenu(bot: TelegramBot, chatId: number, messageId: number | undefined, movieId: string) {
    const movies = readMovies();
    const movie = movies.find(m => m.id === movieId);

    if (!movie) {
        if (messageId) {
            bot.editMessageText("Error: Movie not found.", { chat_id: chatId, message_id: messageId });
        } else {
            bot.sendMessage(chatId, "Error: Movie not found.");
        }
        return;
    }

    const caption = `*Editing: ${movie.title}*\n\n` +
        `*ID:* \`${movie.id}\`\n` +
        `*Description:* ${movie.description.substring(0, 100)}...\n` +
        `*Genre:* ${movie.genre}\n` +
        `*Category:* ${movie.category}\n` +
        `*Stars:* ${movie.stars.join(', ')}\n` +
        `*Rating:* ${movie.rating}\n\n` +
        `Select a field to edit:`;

    // Check if movie.poster is a URL (Azure) or local path
    const posterSource = movie.poster.startsWith('http') ? movie.poster : path.join(__dirname, '../public', movie.poster);

    const keyboard = {
        inline_keyboard: [
            [{ text: "✏️ Title", callback_data: `edit_movie_field_title_${movieId}` }, { text: "✏️ Description", callback_data: `edit_movie_field_description_${movieId}` }],
            [{ text: "✏️ Genre", callback_data: `edit_movie_field_genre_${movieId}` }, { text: "✏️ Category", callback_data: `edit_movie_field_category_${movieId}` }],
            [{ text: "✏️ Stars", callback_data: `edit_movie_field_stars_${movieId}` }, { text: "✏️ Rating", callback_data: `edit_movie_field_rating_${movieId}` }],
            [{ text: "🖼️ Poster", callback_data: `edit_movie_field_poster_${movieId}` }],
            [{ text: "⬅️ Back to Movie List", callback_data: "edit_movie_list" }]
        ]
    };

    // Always send a fresh message instead of trying to edit
    if (movie.poster.startsWith('http') || fs.existsSync(posterSource)) {
        await bot.sendPhoto(chatId, posterSource, {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } else {
        // Fallback if poster file not found
        await bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    // Clear any leftover state after showing the menu
    clearUserState(chatId);
}

async function promptForEditField(bot: TelegramBot, query: TelegramBot.CallbackQuery) {
    if (!query.data || !query.message) return;
    const parts = query.data.split('_');
    const field = parts[3];
    const movieId = parts.slice(4).join('_'); // Handle IDs with underscores
    const userId = query.from.id;

    setUserState(userId, { command: 'editing_movie_value', movieId, field });

    let promptText = `Please enter the new value for *${field}*.`;
    if (field === 'poster') {
        promptText = `Please send the new poster image for the movie.`;
    } else if (field === 'stars') {
        promptText = `Please enter the new stars, separated by commas.`;
    }

    await bot.sendMessage(query.message.chat.id, promptText, { parse_mode: 'Markdown' });
}


export const showMoviesForEditing = (bot: TelegramBot, chatId: number, messageId: number) => {
    const movies = readMovies();
    if (movies.length === 0) {
        bot.sendMessage(chatId, "There are no movies to edit.");
        return;
    }
    const keyboard = movies.map(movie => ([{ text: movie.title, callback_data: `edit_movie_start_${movie.id}` }]));
    keyboard.push([{ text: "⬅️ Back", callback_data: 'manage_movies' }]);

    bot.sendMessage(chatId, "✏️ Select a movie to edit:", {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
};

export const handleEditMovieCallback = async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    if (!query.data || !query.message) return;

    if (query.data.startsWith('edit_movie_start_')) {
        const movieId = query.data.replace('edit_movie_start_', '');
        displayEditMenu(bot, query.message.chat.id, query.message.message_id, movieId);
    } else if (query.data.startsWith('edit_movie_field_')) {
        promptForEditField(bot, query);
    }
};

export async function handleEditMovieResponse(bot: TelegramBot, msg: TelegramBot.Message) {
    const userId = msg.from?.id;
    if (!userId) return;

    const state = getUserState(userId);
    if (!state || state.command !== 'editing_movie_value') return;

    const { movieId, field } = state;
    const movies = readMovies();
    const movieIndex = movies.findIndex(m => m.id === movieId);

    if (movieIndex === -1) {
        bot.sendMessage(userId, "Error: Could not find the movie to update.");
        clearUserState(userId);
        return;
    }
    const movieToUpdate = movies[movieIndex];
    let updateSuccess = false;

    if (field === 'poster') {
        if (msg.photo) {
            try {
                // Handle both Azure blob URLs and local file paths when updating poster
                if (movieToUpdate.poster.startsWith('http')) {
                    // It's an Azure blob URL
                    await deleteFromAzureBlob(movieToUpdate.poster);
                } else if (movieToUpdate.poster.startsWith('/posters/')) {
                    // It's a local file path
                    const oldPosterPath = path.join(process.cwd(), 'public', movieToUpdate.poster);
                    if (fs.existsSync(oldPosterPath)) {
                        fs.unlinkSync(oldPosterPath);
                        console.log(`✅ Deleted old local poster: ${oldPosterPath}`);
                    }
                }
            } catch (err) { console.error(`Could not delete old poster:`, err); }

            const newPosterPath = await savePoster(bot, msg, movieToUpdate.title);
            movies[movieIndex].poster = newPosterPath;
            updateSuccess = true;
        } else {
            bot.sendMessage(userId, "That's not an image. Please send a photo for the poster.");
            return;
        }
    } else {
        if (msg.text) {
            let newValue: any = msg.text;
            if (field === 'rating') {
                newValue = parseFloat(newValue);
                if (isNaN(newValue)) {
                    bot.sendMessage(userId, "Invalid rating. Please enter a number.");
                    return;
                }
            } else if (field === 'stars') {
                newValue = newValue.split(',').map((s: string) => s.trim());
            } else if (field === 'partNumber') {
                newValue = parseInt(newValue, 10);
                if (isNaN(newValue)) {
                    bot.sendMessage(userId, "Invalid part number. Please enter a number.");
                    return;
                }
            }
            (movies[movieIndex] as any)[field] = newValue;
            updateSuccess = true;
        } else {
            bot.sendMessage(userId, "Invalid input. Please provide the requested information.");
            return;
        }
    }

    if (updateSuccess) {
        movies[movieIndex].updatedAt = new Date().toISOString();
        writeMovies(movies);
        await bot.sendMessage(userId, `✅ Success! The *${field}* has been updated.`, { parse_mode: 'Markdown' });

        clearUserState(userId);
        await displayEditMenu(bot, userId, undefined, movieId);
    }
}


// --- DELETE FLOWS ---
export const showMoviesForDeletion = (bot: TelegramBot, chatId: number, messageId: number) => {
    const movies = readMovies();
    if (movies.length === 0) {
        bot.sendMessage(chatId, "There are no movies to delete.");
        return;
    }
    const keyboard = movies.map(movie => ([{ text: movie.title, callback_data: `delete_movie_confirm_${movie.id}` }]));
    keyboard.push([{ text: "⬅️ Back", callback_data: 'manage_movies' }]);

    bot.sendMessage(chatId, "🗑️ Select a movie to delete:", {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
};

export const handleDeleteMovieCallback = async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;
    if (!chatId || !messageId || !data) return;

    const confirmPrefix = 'delete_movie_confirm_';
    const executePrefix = 'delete_movie_execute_';

    if (data.startsWith(confirmPrefix)) {
        const movieId = data.substring(confirmPrefix.length);
        const movie = readMovies().find(m => m.id === movieId);
        if (movie) {
            bot.editMessageText(`Are you sure you want to delete "${movie.title}"? This cannot be undone.`, {
                chat_id: chatId, message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔥 Yes, Delete It", callback_data: `delete_movie_execute_${movieId}` },
                         { text: "⬅️ Cancel", callback_data: "delete_movie_select" }]
                    ]
                }
            });
        }
    } else if (data.startsWith(executePrefix)) {
        const movieId = data.substring(executePrefix.length);
        const movies = readMovies();
        const movieToDelete = movies.find(m => m.id === movieId);
        const updatedMovies = movies.filter(m => m.id !== movieId);

        if (movies.length !== updatedMovies.length && movieToDelete) {
            writeMovies(updatedMovies);
            try {
                // Handle both Azure blob URLs and local file paths
                if (movieToDelete.poster.startsWith('http')) {
                    // It's an Azure blob URL
                    await deleteFromAzureBlob(movieToDelete.poster);
                } else if (movieToDelete.poster.startsWith('/posters/')) {
                    // It's a local file path
                    const posterPath = path.join(__dirname, '../../public', movieToDelete.poster);
                    if (fs.existsSync(posterPath)) {
                        fs.unlinkSync(posterPath);
                        console.log(`✅ Deleted local poster: ${posterPath}`);
                    }
                }
            } catch (err) {
                console.error(`Could not delete poster for movie ID ${movieId}:`, err);
            }
            bot.editMessageText(`✅ Success! Movie "${movieToDelete.title}" has been deleted.`, { chat_id: chatId, message_id: messageId });
        } else {
            bot.editMessageText(`Error: Movie with ID ${movieId} not found.`, { chat_id: chatId, message_id: messageId });
        }
    }
};