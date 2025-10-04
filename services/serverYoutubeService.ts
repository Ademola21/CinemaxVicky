import fs from 'fs';
import path from 'path';
import { ytdlpManager } from './ytdlpBinaryManager';
import { ffmpegService } from './ffmpegService';

export interface YouTubeVideoInfo {
  title: string;
  uploader: string;
  thumbnail: string;
  duration?: number;
  description?: string;
  formats?: any[];
  processedFormats?: ProcessedFormat[];
}

export interface ProcessedFormat {
  format_id: string;
  resolution: string;
  ext: string;
  filesize: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
  url: string;
  quality?: string;
  abr?: number;
  vbr?: number;
  fps?: number;
  acodec?: string;
  vcodec?: string;
}

/**
 * Extracts video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Gets the best available thumbnail URL using fast CDN approach
 */
export function getBestThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Gets fallback thumbnail URL for cases where maxres fails
 */
export function getFallbackThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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
 * Get standard quality label from format information (improved from attached file)
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
 * Filter formats using the improved logic from attached file:
 * - Show only one video format per resolution (lowest file size, prefer MP4)
 * - Show only two audio formats (lowest and highest file size)
 * - Clean resolution labels (144p, 240p, 360p, etc.)
 */
function filterFormats(formats: any[]): ProcessedFormat[] {
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

  // Convert to ProcessedFormat interface
  const processedFormats: ProcessedFormat[] = [];
  
  [...videos, ...audios].forEach(format => {
    const hasVideo = format.vcodec && format.vcodec !== 'none';
    const hasAudio = format.acodec && format.acodec !== 'none';
    const isAudioOnly = !hasVideo && hasAudio;
    
    processedFormats.push({
      format_id: format.format_id,
      resolution: getStandardQuality(format),
      ext: format.ext || 'unknown',
      filesize: format.filesize || format.filesize_approx || 0,
      hasAudio: hasAudio,
      hasVideo: hasVideo,
      isAudioOnly: isAudioOnly,
      url: format.url || '',
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
 * Fetches YouTube video information using yt-dlp-exec
 */
export async function getYouTubeVideoInfo(url: string): Promise<{
  success: boolean;
  data?: YouTubeVideoInfo;
  error?: string;
}> {
  if (!isValidYouTubeURL(url)) {
    return { success: false, error: 'Invalid YouTube URL format' };
  }

  try {
    console.log('📹 Fetching video info using yt-dlp-exec for:', url);
    
    // Extract video ID for fast thumbnail generation
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Could not extract video ID from URL' };
    }
    
    // Use ytdlpManager to get video information in JSON format
    const args = [
      '--dump-single-json',
      '--no-check-certificate',
      '--no-warnings',
      '--prefer-free-formats'
    ];
    
    // Add cookies if file exists
    const cookiePath = ytdlpManager.getCookieFilePath();
    if (cookiePath) {
      args.push('--cookies', cookiePath);
      console.log('🍪 Using cookies file for bot bypass');
    }
    
    const output = await ytdlpManager.execute([...args, url]);
    const info = JSON.parse(output);

    console.log('📹 Raw formats count:', info.formats?.length || 0);

    // Process formats using the improved filtering logic
    const processedFormats = filterFormats(info.formats || []);
    
    console.log('📹 Processed formats count:', processedFormats.length);

    // Generate fast thumbnail URL using your improved approach
    const fastThumbnail = getBestThumbnailUrl(videoId);
    const fallbackThumbnail = getFallbackThumbnailUrl(videoId);
    
    console.log('🖼️ Generated fast thumbnail URL:', fastThumbnail);

    const videoInfo: YouTubeVideoInfo = {
      title: info.title || 'Unknown Title',
      uploader: info.uploader || info.channel || 'Unknown Uploader',
      thumbnail: fastThumbnail,
      duration: info.duration,
      description: info.description,
      formats: info.formats,
      processedFormats: processedFormats
    };

    return { success: true, data: videoInfo };
  } catch (error: any) {
    console.error('❌ Error in getYouTubeVideoInfo with yt-dlp-exec:', error);
    
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

/**
 * Download video with specific format, automatically merging with audio if needed
 * Uses FFmpeg with libfdk_aac for TV-compatible HE-AAC encoding
 */
export async function downloadVideo(
  url: string, 
  formatId: string, 
  outputPath: string,
  progressCallback?: (progress: any) => void
): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  if (!isValidYouTubeURL(url)) {
    return { success: false, error: 'Invalid YouTube URL format' };
  }

  const videoTempPath = outputPath.replace(/\.[^.]+$/, '_video_temp.mp4');
  const audioTempPath = outputPath.replace(/\.[^.]+$/, '_audio_temp.m4a');

  try {
    console.log('📥 Starting download with format:', formatId);
    
    // Get video info to check if format needs audio merging
    const infoResult = await getYouTubeVideoInfo(url);
    if (!infoResult.success || !infoResult.data) {
      return { success: false, error: 'Failed to get video information' };
    }

    const format = infoResult.data.processedFormats?.find(f => f.format_id === formatId);
    if (!format) {
      return { success: false, error: 'Format not found' };
    }

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // If video-only format is selected, download video and audio separately
    // Then merge with FFmpeg using HE-AAC for TV compatibility
    if (format.hasVideo && !format.hasAudio) {
      const audioFormats = infoResult.data.processedFormats?.filter(f => f.isAudioOnly);
      if (audioFormats && audioFormats.length > 0) {
        const lowestAudio = audioFormats.sort((a, b) => a.filesize - b.filesize)[0];
        
        console.log(`🎵 Will merge with audio format (${lowestAudio.format_id})`);
        
        if (progressCallback) {
          progressCallback({ stage: 'downloading_video', progress: 0 });
        }

        // Download video
        console.log('⬇️ Downloading video stream...');
        const videoArgs = [
          '-f', formatId,
          '-o', videoTempPath,
          '--no-check-certificate'
        ];
        
        const cookiePath = ytdlpManager.getCookieFilePath();
        if (cookiePath) {
          videoArgs.push('--cookies', cookiePath);
        }
        
        await ytdlpManager.execute([...videoArgs, url]);

        if (progressCallback) {
          progressCallback({ stage: 'downloading_audio', progress: 50 });
        }

        // Download audio
        console.log('⬇️ Downloading audio stream...');
        const audioArgs = [
          '-f', lowestAudio.format_id,
          '-o', audioTempPath,
          '--no-check-certificate'
        ];
        
        if (cookiePath) {
          audioArgs.push('--cookies', cookiePath);
        }
        
        await ytdlpManager.execute([...audioArgs, url]);

        if (progressCallback) {
          progressCallback({ stage: 'merging', format: 'HE-AAC', progress: 75 });
        }

        // Merge with FFmpeg using HE-AAC (TV compatible)
        console.log('🔀 Merging video + audio with HE-AAC encoding...');
        await ffmpegService.mergeVideoAudioWithHEAAC(videoTempPath, audioTempPath, outputPath);

        // Clean up temp files
        if (fs.existsSync(videoTempPath)) fs.unlinkSync(videoTempPath);
        if (fs.existsSync(audioTempPath)) fs.unlinkSync(audioTempPath);

        // Log audio info
        const audioInfo = await ffmpegService.getAudioInfo(outputPath);
        if (audioInfo) {
          console.log('📊 Audio stream info:', JSON.stringify(audioInfo, null, 2));
        }
      }
    } else {
      // Format already has audio, download directly
      console.log('📁 Downloading to:', outputPath);

      const downloadArgs = [
        '-f', formatId,
        '-o', outputPath,
        '--no-check-certificate'
      ];
      
      const cookiePath = ytdlpManager.getCookieFilePath();
      if (cookiePath) {
        downloadArgs.push('--cookies', cookiePath);
      }
      
      await ytdlpManager.execute([...downloadArgs, url]);
    }

    console.log('✅ Download completed successfully');
    
    if (progressCallback) {
      progressCallback({ stage: 'complete', progress: 100 });
    }

    return { success: true, filePath: outputPath };
  } catch (error: any) {
    console.error('❌ Error in downloadVideo:', error);
    
    // Clean up temp files on error
    if (fs.existsSync(videoTempPath)) fs.unlinkSync(videoTempPath);
    if (fs.existsSync(audioTempPath)) fs.unlinkSync(audioTempPath);
    
    if (progressCallback) {
      progressCallback({ stage: 'error', error: error.message });
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to download video' 
    };
  }
}

/**
 * Get the best format for merging (lowest audio format)
 */
export function getBestAudioFormat(processedFormats: ProcessedFormat[]): ProcessedFormat | null {
  const audioFormats = processedFormats.filter(f => f.isAudioOnly);
  if (audioFormats.length === 0) return null;
  
  // Return lowest file size audio format
  return audioFormats.sort((a, b) => a.filesize - b.filesize)[0];
}