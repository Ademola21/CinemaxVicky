import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export class FFmpegService {
  private static instance: FFmpegService;
  private ffmpegPath: string;
  private ffprobePath: string;

  private constructor() {
    // Check for custom FFmpeg with libfdk_aac support
    const homeDir = os.homedir();
    const customFfmpegPath = path.join(homeDir, 'ffmpeg-bin/usr/local/bin/ffmpeg');
    const customFfprobePath = path.join(homeDir, 'ffmpeg-bin/usr/local/bin/ffprobe');

    if (fs.existsSync(customFfmpegPath)) {
      this.ffmpegPath = customFfmpegPath;
      this.ffprobePath = customFfprobePath;
      console.log('✅ Using custom FFmpeg with libfdk_aac support');
    } else {
      // Fallback to system FFmpeg (won't have libfdk_aac but will still work)
      this.ffmpegPath = 'ffmpeg';
      this.ffprobePath = 'ffprobe';
      console.log('⚠️ Using system FFmpeg (libfdk_aac not available)');
    }
  }

  public static getInstance(): FFmpegService {
    if (!FFmpegService.instance) {
      FFmpegService.instance = new FFmpegService();
    }
    return FFmpegService.instance;
  }

  /**
   * Check if libfdk_aac encoder is available
   */
  public async hasLibFdkAac(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(this.ffmpegPath, ['-encoders']);
      return stdout.includes('libfdk_aac');
    } catch (error) {
      console.error('Failed to check for libfdk_aac:', error);
      return false;
    }
  }

  /**
   * Merge video and audio files with HE-AAC encoding
   * Uses libfdk_aac for TV-compatible AAC LC SBR format
   * 
   * @param videoPath - Path to video file
   * @param audioPath - Path to audio file
   * @param outputPath - Path for merged output
   * @param options - Encoding options
   */
  public async mergeVideoAudioWithHEAAC(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    options?: {
      audioBitrate?: string;
      audioChannels?: number;
      sampleRate?: number;
    }
  ): Promise<void> {
    const hasLibFdk = await this.hasLibFdkAac();

    const args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy', // Copy video stream (no re-encoding)
    ];

    if (hasLibFdk) {
      // Use libfdk_aac for HE-AAC (AAC LC SBR) - TV compatible
      args.push(
        '-c:a', 'libfdk_aac',
        '-profile:a', 'aac_he', // HE-AAC profile (AAC LC SBR)
        '-b:a', options?.audioBitrate || '30k', // Low bitrate for small file size
        '-ac', String(options?.audioChannels || 2), // Stereo
        '-ar', String(options?.sampleRate || 44100), // 44.1 kHz sample rate
      );
      console.log('🎵 Encoding with libfdk_aac HE-AAC (AAC LC SBR) - TV compatible');
    } else {
      // Fallback to native AAC encoder (not as good quality)
      args.push(
        '-c:a', 'aac',
        '-b:a', options?.audioBitrate || '128k', // Higher bitrate needed for native encoder
        '-ac', String(options?.audioChannels || 2),
        '-ar', String(options?.sampleRate || 44100),
      );
      console.log('⚠️ Encoding with native AAC (libfdk_aac not available)');
    }

    // Add additional flags
    args.push(
      '-fflags', '+genpts', // Generate presentation timestamps
      '-y', // Overwrite output file
      outputPath
    );

    console.log('🔀 Merging video + audio with FFmpeg...');
    console.log('📝 FFmpeg command:', this.ffmpegPath, args.join(' '));

    try {
      const { stdout, stderr } = await execFileAsync(this.ffmpegPath, args, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for FFmpeg output
      });

      if (stderr) {
        // FFmpeg outputs to stderr even on success
        console.log('FFmpeg output:', stderr);
      }

      console.log('✅ Video + audio merged successfully');
    } catch (error: any) {
      console.error('❌ FFmpeg error:', error.stderr || error.message);
      throw new Error(`FFmpeg merge failed: ${error.stderr || error.message}`);
    }
  }

  /**
   * Get audio stream information from a video file
   */
  public async getAudioInfo(filePath: string): Promise<any> {
    try {
      const { stdout } = await execFileAsync(this.ffprobePath, [
        '-v', 'quiet',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_name,bit_rate,channels,sample_rate,profile',
        '-of', 'json',
        filePath
      ]);

      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Failed to get audio info:', error);
      return null;
    }
  }

  /**
   * Get the FFmpeg path being used
   */
  public getFfmpegPath(): string {
    return this.ffmpegPath;
  }

  /**
   * Get the FFprobe path being used
   */
  public getFfprobePath(): string {
    return this.ffprobePath;
  }
}

// Export singleton instance
export const ffmpegService = FFmpegService.getInstance();
