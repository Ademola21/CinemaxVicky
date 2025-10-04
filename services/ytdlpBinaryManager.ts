import fs from 'fs';
import https from 'https';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class YtDlpBinaryManager {
  private static instance: YtDlpBinaryManager;
  private readonly binDir: string;
  private readonly ytdlpPath: string;
  private readonly currentVersion: string = '2025.09.26';
  private readonly ytdlpUrl: string;

  private constructor() {
    this.binDir = path.resolve('./bin');
    // Use Windows executable on Windows
    const isWindows = process.platform === 'win32';
    this.ytdlpPath = path.resolve(this.binDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
    this.ytdlpUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${this.currentVersion}/${isWindows ? 'yt-dlp.exe' : 'yt-dlp_linux'}`;
    
    // Ensure bin directory exists
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  public static getInstance(): YtDlpBinaryManager {
    if (!YtDlpBinaryManager.instance) {
      YtDlpBinaryManager.instance = new YtDlpBinaryManager();
    }
    return YtDlpBinaryManager.instance;
  }

  /**
   * Ensures the yt-dlp binary is available and up to date
   */
  public async ensureBinary(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(this.ytdlpPath)) {
        try {
          const stats = fs.statSync(this.ytdlpPath);
          if (stats.size > 1000000) { // At least 1MB
            // Only set executable permissions on Unix-like systems
            if (process.platform !== 'win32') {
              fs.chmodSync(this.ytdlpPath, 0o755);
            }
            console.log(`✅ yt-dlp binary ready (${(stats.size / 1048576).toFixed(1)} MB)`);
            resolve();
            return;
          } else {
            console.log('⚠️ Found corrupted yt-dlp binary, deleting...');
            fs.unlinkSync(this.ytdlpPath);
          }
        } catch (error) {
          console.error('⚠️ Error checking existing binary:', (error as Error).message);
        }
      }

      console.log('⬇️ Downloading yt-dlp binary...');
      this.downloadBinary()
        .then(() => {
          console.log('✅ yt-dlp binary downloaded successfully');
          resolve();
        })
        .catch((error) => {
          console.error('❌ Failed to download yt-dlp binary:', error);
          reject(error);
        });
    });
  }

  /**
   * Downloads the yt-dlp binary from GitHub
   */
  private downloadBinary(): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(this.ytdlpPath);

      const download = (url: string) => {
        https.get(url, (res) => {
          // Follow redirects
          if (res.statusCode === 302 || res.statusCode === 301) {
            if (res.headers.location) {
              download(res.headers.location);
              return;
            }
          }

          if (res.statusCode !== 200) {
            if (fs.existsSync(this.ytdlpPath)) {
              fs.unlinkSync(this.ytdlpPath);
            }
            reject(new Error(`Failed to download yt-dlp: HTTP ${res.statusCode}`));
            return;
          }

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            try {
              // Set executable permissions (Unix only)
              if (process.platform !== 'win32') {
                fs.chmodSync(this.ytdlpPath, 0o755);
              }
              
              // Verify download integrity
              const stats = fs.statSync(this.ytdlpPath);
              if (stats.size < 1000000) {
                fs.unlinkSync(this.ytdlpPath);
                reject(new Error('Downloaded yt-dlp file too small, download failed'));
                return;
              }

              console.log(`✅ yt-dlp binary installed (${(stats.size / 1048576).toFixed(1)} MB)`);
              resolve();
            } catch (error) {
              if (fs.existsSync(this.ytdlpPath)) {
                fs.unlinkSync(this.ytdlpPath);
              }
              reject(new Error(`Failed to finalize yt-dlp binary: ${(error as Error).message}`));
            }
          });

          file.on('error', (error) => {
            if (fs.existsSync(this.ytdlpPath)) {
              fs.unlinkSync(this.ytdlpPath);
            }
            reject(error);
          });
        }).on('error', (error) => {
          if (fs.existsSync(this.ytdlpPath)) {
            fs.unlinkSync(this.ytdlpPath);
          }
          reject(error);
        });
      };

      download(this.ytdlpUrl);
    });
  }

  /**
   * Executes yt-dlp with the given arguments
   */
  public async execute(args: string[]): Promise<string> {
    await this.ensureBinary();
    
    try {
      const { stdout, stderr } = await execFileAsync(this.ytdlpPath, args);
      if (stderr) {
        console.warn('yt-dlp stderr:', stderr);
      }
      return stdout;
    } catch (error: any) {
      const errorMessage = error.stderr || error.message || 'Unknown yt-dlp execution error';
      throw new Error(errorMessage);
    }
  }

  /**
   * Gets video information in JSON format with bot bypass
   */
  public async getVideoInfo(url: string): Promise<any> {
    const args = this.buildArgsWithAuth([
      '--dump-single-json',
      '--no-check-certificate', 
      '--no-warnings',
      '--prefer-free-formats'
    ]);
    
    const output = await this.execute([...args, url]);

    try {
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to parse yt-dlp JSON output: ${(error as Error).message}`);
    }
  }

  /**
   * Downloads a video with specified format and bot bypass
   */
  public async downloadVideo(url: string, formatId: string, outputPath: string): Promise<void> {
    const args = this.buildArgsWithAuth([
      '-f', formatId,
      '-o', outputPath
    ]);
    
    await this.execute([...args, url]);
  }

  /**
   * Downloads a video with format fallback for unavailable formats
   */
  public async downloadVideoWithFallback(url: string, formatId: string, outputPath: string): Promise<void> {
    try {
      // First try the exact format
      const args = this.buildArgsWithAuth([
        '-f', formatId,
        '-o', outputPath
      ]);
      
      await this.execute([...args, url]);
    } catch (error: any) {
      if (error.message?.includes('Requested format is not available')) {
        console.log(`⚠️ Format ${formatId} not available, trying fallback...`);
        
        // Extract quality from format ID and create fallback
        let fallbackFormat = 'best';
        
        // Try to match common format patterns
        if (formatId.includes('396') || formatId.includes('360')) {
          fallbackFormat = 'best[height<=360]+bestaudio/best';
        } else if (formatId.includes('397') || formatId.includes('480')) {
          fallbackFormat = 'best[height<=480]+bestaudio/best';
        } else if (formatId.includes('398') || formatId.includes('720')) {
          fallbackFormat = 'best[height<=720]+bestaudio/best';
        } else if (formatId.includes('399') || formatId.includes('1080')) {
          fallbackFormat = 'best[height<=1080]+bestaudio/best';
        } else if (formatId.includes('140') || formatId.includes('audio')) {
          fallbackFormat = 'bestaudio';
        }
        
        console.log(`🔄 Using fallback format: ${fallbackFormat}`);
        
        const fallbackArgs = this.buildArgsWithAuth([
          '-f', fallbackFormat,
          '-o', outputPath
        ]);
        
        await this.execute([...fallbackArgs, url]);
      } else {
        throw error;
      }
    }
  }

  /**
   * Builds yt-dlp arguments with authentication/bot bypass options
   */
  private buildArgsWithAuth(baseArgs: string[]): string[] {
    const args = [...baseArgs];
    
    // Add user-agent to mimic real browser
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Environment-specific cookie handling
    if (process.env.REPL_ID) {
      // Running on Replit - use cookie file approach since browser cookies aren't reliable
      console.log('🔓 Using Replit cookie file for bot bypass');
      this.addCookieFileIfExists(args);
    } else {
      // Running on VPS - use cookie file approach
      this.addCookieFileIfExists(args);
      
      // Add additional bot bypass options for VPS
      args.push(
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        '--socket-timeout', '30',
        '--retries', '3'
      );
      console.log('🔓 Using VPS bot bypass configuration');
    }
    
    return args;
  }

  /**
   * Adds cookie file to arguments if it exists
   */
  private addCookieFileIfExists(args: string[]): void {
    const cookiePath = path.resolve(this.binDir, 'youtube-cookies.txt');
    
    if (fs.existsSync(cookiePath)) {
      args.push('--cookies', cookiePath);
      console.log('🍪 Using cookie file for authentication:', cookiePath);
    } else {
      console.log('⚠️ No cookie file found at:', cookiePath);
      console.log('📖 See: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp');
    }
  }

  /**
   * Get the cookie file path if it exists
   */
  public getCookieFilePath(): string | null {
    const cookiePath = path.resolve(this.binDir, 'youtube-cookies.txt');
    return fs.existsSync(cookiePath) ? cookiePath : null;
  }

  /**
   * Creates a sample cookie file with instructions
   */
  public createSampleCookieFile(): void {
    const cookiePath = path.join(this.binDir, 'youtube-cookies.txt');
    const sampleContent = `# Netscape HTTP Cookie File
# This file contains cookies for YouTube authentication to bypass bot detection
# 
# HOW TO GET COOKIES:
# 1. Install browser extension "Get cookies.txt LOCALLY" (Chrome/Firefox)
# 2. Go to YouTube.com and log in to your account
# 3. Visit any YouTube video (recommended)
# 4. Use extension to export cookies in Netscape format
# 5. Replace this file content with exported cookies
#
# FORMAT EXAMPLE:
# .youtube.com\tTRUE\t/\tFALSE\t1234567890\tname\tvalue
#
# NOTE: Keep this file secure and don't commit it to version control

# Your exported cookies will replace this content
`;
    
    try {
      fs.writeFileSync(cookiePath, sampleContent);
      console.log(`📝 Sample cookie file created at: ${cookiePath}`);
      console.log('🔧 Follow instructions in the file to add real YouTube cookies');
    } catch (error) {
      console.error('Failed to create sample cookie file:', error);
    }
  }

  /**
   * Checks if a newer version of yt-dlp is available on GitHub
   */
  public async checkForUpdates(): Promise<{ hasUpdate: boolean; latestVersion?: string }> {
    return new Promise((resolve) => {
      https.get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers: {
          'User-Agent': 'YorubaCinemax-YtDlp-Updater'
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const latestVersion = release.tag_name;
            const hasUpdate = latestVersion !== this.currentVersion;
            resolve({ hasUpdate, latestVersion });
          } catch (error) {
            console.error('Failed to check for yt-dlp updates:', error);
            resolve({ hasUpdate: false });
          }
        });
      }).on('error', (error) => {
        console.error('Failed to check for yt-dlp updates:', error);
        resolve({ hasUpdate: false });
      });
    });
  }

  /**
   * Get the path to the yt-dlp binary
   */
  public getBinaryPath(): string {
    return this.ytdlpPath;
  }
}

// Export singleton instance
export const ytdlpManager = YtDlpBinaryManager.getInstance();
