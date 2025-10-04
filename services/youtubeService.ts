// Client-side YouTube service - makes API calls to the server
import * as storage from './storageService';

export interface ProcessedFormat {
  format_id: string;
  resolution: string;
  ext: string;
  filesize?: number;
  actualFilesize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
}

export interface VideoDetails {
  id: string;
  thumbnail: string;
  title: string;
  channel: string;
}

/**
 * Gets YouTube video information via API call to server
 */
export async function getYouTubeVideoInfo(url: string): Promise<{
  success: boolean;
  data?: {
    info: VideoDetails & { uploader: string };
    processedFormats: ProcessedFormat[];
  };
  error?: string;
}> {
  try {
    const session = storage.getSession();
    
    const response = await fetch('/api/youtube-downloader', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        session 
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to fetch video information'
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to process video'
      };
    }

    return {
      success: true,
      data: {
        info: {
          id: result.info.id,
          thumbnail: result.info.thumbnail,
          title: result.info.title,
          channel: result.info.uploader,
          uploader: result.info.uploader
        },
        processedFormats: [...(result.videoFormats || []), ...(result.audioFormats || [])]
      }
    };
  } catch (error) {
    console.error('Error fetching YouTube video info:', error);
    return {
      success: false,
      error: 'Network error while fetching video information'
    };
  }
}

/**
 * Gets download URL for a specific format via API call to server
 */
export async function getDownloadUrl(videoUrl: string, formatId: string): Promise<{
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const session = storage.getSession();
    
    const response = await fetch('/api/youtube-downloader', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: videoUrl,
        formatId: formatId,
        session 
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to get download URL'
      };
    }

    const result = await response.json();

    return {
      success: result.success,
      downloadUrl: result.downloadUrl,
      filename: result.filename,
      error: result.error
    };
  } catch (error) {
    console.error('Error getting download URL:', error);
    return {
      success: false,
      error: 'Network error while getting download URL'
    };
  }
}

/**
 * Basic YouTube URL validation for client-side
 */
export function isValidYouTubeURL(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(url);
}

/**
 * Connect to download progress stream using Server-Sent Events
 */
export function connectToProgressStream(
  downloadId: string, 
  onProgress: (progressData: any) => void,
  onError?: (error: any) => void,
  onComplete?: () => void
): () => void {
  let eventSource: EventSource | null = null;
  let retryCount = 0;
  const maxRetries = 3;
  let isManualClose = false;
  
  const connect = () => {
    if (isManualClose) return;
    
    console.log(`📡 Connecting to progress stream (attempt ${retryCount + 1})`);
    eventSource = new EventSource(`/api/download-progress/${downloadId}`);
    
    eventSource.onopen = () => {
      console.log('📡 Progress stream connected successfully');
      retryCount = 0; // Reset retry count on successful connection
    };
    
    eventSource.onmessage = (event) => {
      try {
        const progressData = JSON.parse(event.data);
        console.log('📡 Progress data received:', progressData);
        onProgress(progressData);
        
        // Close connection when download is complete
        if (progressData.stage === 'complete' || progressData.stage === 'error') {
          isManualClose = true;
          eventSource?.close();
          if (onComplete) onComplete();
        }
      } catch (error) {
        console.error('Failed to parse progress data:', error);
        if (onError) onError(error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('Progress stream error:', error);
      eventSource?.close();
      
      if (!isManualClose && retryCount < maxRetries) {
        retryCount++;
        console.log(`📡 Retrying connection in 2 seconds (${retryCount}/${maxRetries})`);
        setTimeout(connect, 2000);
      } else {
        console.error('📡 Max retries reached or manual close');
        if (onError) onError(error);
      }
    };
  };
  
  // Start initial connection
  connect();
  
  // Return cleanup function
  return () => {
    isManualClose = true;
    if (eventSource) {
      eventSource.close();
    }
  };
}

/**
 * Extract download ID from download URL for progress tracking
 */
export function extractDownloadId(downloadUrl: string): string | null {
  const match = downloadUrl.match(/\/api\/download-file\/([^/]+)/);
  return match ? match[1] : null;
}