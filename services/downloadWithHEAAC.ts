import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ytdlpManager } from './ytdlpBinaryManager';
import { ffmpegService } from './ffmpegService';
import { getYouTubeVideoInfo } from './serverYoutubeService';

export interface DownloadProgress {
    stage: string;
    progress: number;
    error?: string;
}

/**
 * Downloads a YouTube video with HE-AAC audio encoding
 * Follows the exact approach from the user's working script:
 * 1. Download video stream separately
 * 2. Download smallest audio stream separately
 * 3. Merge with FFmpeg using libfdk_aac HE-AAC
 */
export async function downloadYouTubeWithHEAAC(
    videoUrl: string,
    formatId: string,
    outputPath: string,
    progressCallback?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const tempBasename = `yt-heaac-${Date.now()}`;
    const videoTempPath = path.join(os.tmpdir(), `${tempBasename}_video.mp4`);
    const audioTempPath = path.join(os.tmpdir(), `${tempBasename}_audio.webm`);

    try {
        // Get video information to find smallest audio format
        progressCallback?.({ stage: 'info', progress: 5 });
        const infoResult = await getYouTubeVideoInfo(videoUrl);
        if (!infoResult.success || !infoResult.data) {
            return { success: false, error: 'Failed to get video information' };
        }

        // Find smallest audio format
        const audioFormats = infoResult.data.processedFormats?.filter(f => f.isAudioOnly) || [];
        if (audioFormats.length === 0) {
            return { success: false, error: 'No audio formats found' };
        }
        const smallestAudio = audioFormats.sort((a, b) => a.filesize - b.filesize)[0];

        console.log(`📥 Downloading - Video: ${formatId}, Audio: ${smallestAudio.format_id}`);

        // Step 1: Download video stream
        progressCallback?.({ stage: 'downloading_video', progress: 10 });
        console.log('⬇️ Downloading video stream...');
        
        await ytdlpManager.ensureBinary();
        const cookiePath = ytdlpManager.getCookieFilePath();
        
        const videoArgs = ['-f', formatId, '-o', videoTempPath];
        if (cookiePath) videoArgs.push('--cookies', cookiePath);
        videoArgs.push(videoUrl);
        
        await ytdlpManager.execute(videoArgs);

        // Step 2: Download audio stream
        progressCallback?.({ stage: 'downloading_audio', progress: 50 });
        console.log('⬇️ Downloading audio stream...');
        
        const audioArgs = ['-f', smallestAudio.format_id, '-o', audioTempPath];
        if (cookiePath) audioArgs.push('--cookies', cookiePath);
        audioArgs.push(videoUrl);
        
        await ytdlpManager.execute(audioArgs);

        // Step 3: Merge with FFmpeg using HE-AAC
        progressCallback?.({ stage: 'merging_heaac', progress: 80 });
        console.log('🔀 Merging with FFmpeg (HE-AAC 30k, 44.1kHz)...');
        
        await ffmpegService.mergeVideoAudioWithHEAAC(videoTempPath, audioTempPath, outputPath, {
            audioBitrate: '30k',
            audioChannels: 2,
            sampleRate: 44100
        });

        // Clean up temp files
        if (fs.existsSync(videoTempPath)) fs.unlinkSync(videoTempPath);
        if (fs.existsSync(audioTempPath)) fs.unlinkSync(audioTempPath);

        progressCallback?.({ stage: 'complete', progress: 100 });
        console.log('✅ Download with HE-AAC complete:', outputPath);

        return { success: true, filePath: outputPath };

    } catch (error: any) {
        console.error('❌ Download with HE-AAC failed:', error);
        
        // Clean up temp files on error
        try {
            if (fs.existsSync(videoTempPath)) fs.unlinkSync(videoTempPath);
            if (fs.existsSync(audioTempPath)) fs.unlinkSync(audioTempPath);
        } catch (e) {}

        progressCallback?.({ stage: 'error', progress: 0, error: error.message });
        return { success: false, error: error.message || 'Download failed' };
    }
}
