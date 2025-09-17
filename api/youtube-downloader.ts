
/**
 * This file acts as a secure backend proxy for the third-party YouTube downloader service.
 * It is intended to be deployed as a serverless function.
 * The frontend will send requests to this endpoint ('/api/youtube-downloader').
 * This function then validates the request and forwards it to the external service.
 *
 * This pattern prevents exposing the third-party service directly to users,
 * hides user IP addresses, and allows us to add caching or swap services later.
 */

const DOWNLOADER_API_ENDPOINT = 'https://co.wuk.sh/api/json';

export default async function handler(request: { json: () => Promise<any> }) {
  try {
    const { url: videoUrl } = await request.json();

    if (!videoUrl || typeof videoUrl !== 'string') {
        return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing or invalid URL parameter.' })
        };
    }
    
    // Basic validation to ensure it looks like a YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(videoUrl)) {
        return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid YouTube URL provided.' })
        };
    }

    // Forward the request to the actual downloader service
    const serviceResponse = await fetch(DOWNLOADER_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: videoUrl, isNoTTWatermark: true, isAudioOnly: false })
    });

    const data = await serviceResponse.json();

    // Pass the response from the service back to our frontend client
    return {
      status: serviceResponse.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Error in YouTube Downloader proxy function:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'An internal error occurred while fetching video data.' })
    };
  }
}