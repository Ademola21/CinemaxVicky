import readline from "readline";
import { exec } from "child_process";
import { mkdir } from "fs/promises";

// Path where downloads will be saved
const OUTPUT_DIR = "/storage/emulated/0/yt-core";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function isValidYouTubeURL(url) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(url);
}

function selectBestFormats(formats) {
  // Group formats by resolution
  const groups = {};
  for (const f of formats) {
    const res = f.resolution || "audio only";
    if (!groups[res]) groups[res] = [];
    groups[res].push(f);
  }

  const filtered = [];
  
  for (const res in groups) {
    const resFormats = groups[res];
    
    // Separate MP4 and WEBM formats
    const mp4Formats = resFormats.filter(f => f.ext === 'mp4').sort((a, b) => (a.filesize || 0) - (b.filesize || 0));
    const webmFormats = resFormats.filter(f => f.ext === 'webm').sort((a, b) => (a.filesize || 0) - (b.filesize || 0));
    
    if (mp4Formats.length > 0) {
      // If we have MP4 formats
      if (mp4Formats.length === 1) {
        // Only one MP4, add it
        filtered.push(mp4Formats[0]);
        
        // If we also have WEBM, add the best one as alternative
        if (webmFormats.length > 0) {
          // Find the WEBM that's different in size from our MP4
          const mp4Size = mp4Formats[0].filesize || 0;
          let bestWebm = null;
          
          if (webmFormats.length === 1) {
            bestWebm = webmFormats[0];
          } else {
            // Pick highest WEBM if MP4 is lowest, or lowest WEBM if MP4 is highest
            const lowestWebm = webmFormats[0];
            const highestWebm = webmFormats[webmFormats.length - 1];
            
            // Compare with all formats in this resolution to determine if MP4 is lowest or highest
            const allSorted = resFormats.filter(f => f.filesize).sort((a, b) => a.filesize - b.filesize);
            const mp4Index = allSorted.findIndex(f => f.format_id === mp4Formats[0].format_id);
            
            if (mp4Index <= allSorted.length / 2) {
              // MP4 is in lower half, pick highest WEBM
              bestWebm = highestWebm;
            } else {
              // MP4 is in upper half, pick lowest WEBM
              bestWebm = lowestWebm;
            }
          }
          
          if (bestWebm && bestWebm.filesize !== mp4Size) {
            filtered.push(bestWebm);
          }
        }
      } else {
        // Multiple MP4s available, add lowest and highest
        filtered.push(mp4Formats[0]); // lowest
        filtered.push(mp4Formats[mp4Formats.length - 1]); // highest
      }
    } else if (webmFormats.length > 0) {
      // No MP4, fall back to WEBM
      filtered.push(webmFormats[0]); // lowest
      if (webmFormats.length > 1) {
        filtered.push(webmFormats[webmFormats.length - 1]); // highest
      }
    } else {
      // No MP4 or WEBM, add other formats
      const otherFormats = resFormats.filter(f => f.filesize).sort((a, b) => a.filesize - b.filesize);
      if (otherFormats.length > 0) {
        filtered.push(otherFormats[0]); // lowest
        if (otherFormats.length > 1) {
          filtered.push(otherFormats[otherFormats.length - 1]); // highest
        }
      }
    }
  }

  return filtered;
}

async function main() {
  const url = await ask("👉 Enter YouTube URL: ");
  
  if (!isValidYouTubeURL(url)) {
    console.log("❌ Please enter a valid YouTube URL");
    rl.close();
    return;
  }

  console.log("🔍 Fetching available formats...\n");

  exec(`yt-dlp -j "${url}"`, async (err, stdout) => {
    if (err) {
      console.error("❌ Error fetching info:", err.message);
      rl.close();
      return;
    }

    try {
      const info = JSON.parse(stdout);
      const formats = info.formats.filter((f) => f.url);
      const filtered = selectBestFormats(formats);

      if (filtered.length === 0) {
        console.log("❌ No suitable formats found");
        rl.close();
        return;
      }

      // Display clean list with format preference indicator
      filtered.forEach((f, i) => {
        const sizeMB = f.filesize ? (f.filesize / 1048576).toFixed(1) : "?";
        const preference = f.ext === 'mp4' ? '⭐' : f.ext === 'webm' ? '📹' : '📄';
        const audioInfo = (f.acodec === 'none' || !f.acodec) ? ' + bestaudio' : '';
        console.log(`[${i}] ${preference} ${f.resolution || "audio only"} | ${f.ext.toUpperCase()}${audioInfo} | ${sizeMB} MB | id=${f.format_id}`);
      });

      const choice = await ask("\n👉 Enter number to download: ");
      const selected = filtered[parseInt(choice)];
      if (!selected) {
        console.log("❌ Invalid choice");
        rl.close();
        return;
      }

      console.log(`\n⬇️ Downloading ${selected.format_id} (${selected.ext.toUpperCase()})...`);

      // Ensure output directory exists
      try {
        await mkdir(OUTPUT_DIR, { recursive: true });
      } catch (err) {
        // Directory might already exist, continue
      }

      const outFile = `${OUTPUT_DIR}/%(title)s.%(ext)s`;
      
      // Check if selected format has audio, if not merge with best audio
      let downloadCmd;
      if (selected.acodec === 'none' || !selected.acodec) {
        // Video-only format, merge with best audio
        downloadCmd = `yt-dlp -o "${outFile}" -f "${selected.format_id}+bestaudio" "${url}"`;
        console.log("🎵 Merging with best available audio...");
      } else {
        // Format already has audio
        downloadCmd = `yt-dlp -o "${outFile}" -f ${selected.format_id} "${url}"`;
      }

      exec(downloadCmd, (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Download error:", stderr);
        } else {
          console.log("✅ Download complete!");
        }
        rl.close();
      });
    } catch (parseError) {
      console.error("❌ Error parsing video info:", parseError.message);
      rl.close();
    }
  });
}

// Graceful exit handling
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

main();