// Updated YouTube service using yt-dlp-exec instead of Python yt-dlp
import ytdlp from 'yt-dlp-exec';

// Simplified YouTube service for bot use only
export interface YouTubeVideoInfo {
  title: string;
  uploader: string;
  thumbnail: string;
  duration?: number;
  description?: string;
}

/**
 * Validates if a URL is a valid YouTube URL and safe from injection
 */
export function isValidYouTubeURL(url: string): boolean {
  // Check for basic YouTube URL pattern
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(url)) {
    return false;
  }

  // Security: Reject URLs with quotes, backticks, or other shell metacharacters
  if (/[`'"\\$;|&<>(){}\[\]]/.test(url)) {
    return false;
  }

  // Additional security: ensure no whitespace that could be used for injection
  if (/\s/.test(url)) {
    return false;
  }

  return true;
}

/**
 * Get standard quality label from format information
 */
function getStandardQuality(format: any): string {
  if (format.vcodec === "none") return "audio only";
  if (format.height <= 144) return "144p";
  if (format.height <= 240) return "240p";
  if (format.height <= 360) return "360p";
  if (format.height <= 480) return "480p";
  if (format.height <= 720) return "720p";
  if (format.height <= 1080) return "1080p";
  if (format.height <= 1440) return "1440p";
  if (format.height <= 2160) return "2160p (4K)";
  return `${format.height}p`;
}

/**
 * Filter formats using the improved logic from attached file
 */
function processFormats(formats: any[]): any[] {
  const videoGroups: { [key: string]: any[] } = {};
  const audio: any[] = [];

  // Group formats by type and quality
  for (const f of formats) {
    // Skip formats without filesize data
    if (!f.filesize && !f.filesize_approx) continue;
    
    if (f.vcodec === "none") {
      audio.push(f);
    } else {
      const q = getStandardQuality(f);
      if (!videoGroups[q]) videoGroups[q] = [];
      videoGroups[q].push(f);
    }
  }

  const videos: any[] = [];
  
  // Select best video format for each quality (prefer MP4, lowest file size)
  for (const q in videoGroups) {
    const arr = videoGroups[q].sort((a, b) => {
      const sizeA = a.filesize || a.filesize_approx || 0;
      const sizeB = b.filesize || b.filesize_approx || 0;
      return sizeA - sizeB;
    });
    
    // Prefer MP4 format, otherwise use the smallest
    const mp4 = arr.find(f => f.ext === "mp4");
    videos.push(mp4 || arr[0]);
  }

  // Select audio formats (lowest and highest file size)
  audio.sort((a, b) => {
    const sizeA = a.filesize || a.filesize_approx || 0;
    const sizeB = b.filesize || b.filesize_approx || 0;
    return sizeA - sizeB;
  });
  
  const audios = audio.length > 1 ? [audio[0], audio[audio.length - 1]] : audio;

  // Convert to processed format
  const processedFormats: any[] = [];
  
  [...videos, ...audios].forEach(format => {
    const hasVideo = format.vcodec && format.vcodec !== 'none';
    const hasAudio = format.acodec && format.acodec !== 'none';
    const isAudioOnly = !hasVideo && hasAudio;
    
    processedFormats.push({
      format_id: format.format_id,
      resolution: getStandardQuality(format),
      ext: format.ext || 'unknown',
      filesize: format.filesize,
      actualFilesize: format.filesize || format.filesize_approx,
      hasAudio: hasAudio,
      hasVideo: hasVideo,
      isAudioOnly: isAudioOnly,
      url: format.url,
      quality: format.quality,
      abr: format.abr,
      vbr: format.vbr,
      fps: format.fps,
      acodec: format.acodec,
      vcodec: format.vcodec
    });
  });

  return processedFormats;
}

/**
 * Fetches YouTube video information using yt-dlp-exec instead of Python yt-dlp
 */
export async function getYouTubeVideoInfo(url: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  if (!isValidYouTubeURL(url)) {
    return { success: false, error: 'Invalid YouTube URL format' };
  }

  try {
    console.log('📹 [BOT] Fetching video info using yt-dlp-exec for:', url);
    
    // Use yt-dlp-exec to get video information in JSON format
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    console.log('📹 [BOT] Raw formats count:', info.formats?.length || 0);

    // Process formats using the improved filtering logic
    const processedFormats = processFormats(info.formats || []);
    
    console.log('📹 [BOT] Processed formats count:', processedFormats.length);

    // Add processed formats to the data (maintain compatibility with existing code)
    const data = {
      title: info.title || 'Unknown Title',
      uploader: info.uploader || info.channel || 'Unknown Uploader',
      thumbnail: info.thumbnail || '',
      duration: info.duration,
      description: info.description,
      formats: info.formats,
      processedFormats: processedFormats
    };

    return { success: true, data };
  } catch (error: any) {
    console.error('❌ [BOT] Error in getYouTubeVideoInfo with yt-dlp-exec:', error);
    
    // Handle specific yt-dlp-exec errors
    if (error.message?.includes('unavailable')) {
      return { success: false, error: 'Video is unavailable or private' };
    } else if (error.message?.includes('not found')) {
      return { success: false, error: 'Video not found' };
    } else if (error.message?.includes('network')) {
      return { success: false, error: 'Network error while fetching video information' };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to extract video information' 
    };
  }
}