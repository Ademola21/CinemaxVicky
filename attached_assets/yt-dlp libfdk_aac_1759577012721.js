import readline from "readline";
import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";

const BIN_DIR = "./bin";
const YTDLP_PATH = path.resolve(BIN_DIR, "yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

// ✅ FFmpeg + ffprobe path (your custom libfdk_aac build)
const FFMPEG_PATH = path.resolve(process.env.HOME, "ffmpeg-bin/usr/local/bin/ffmpeg");
const FFPROBE_PATH = path.resolve(process.env.HOME, "ffmpeg-bin/usr/local/bin/ffprobe");

// ✅ Your yt-dlp cookies file (store in project root or Replit secrets folder)
const COOKIES_FILE = path.resolve("./cookies.txt");

// ✅ Output folder (for Replit)
const OUTPUT_DIR = "./downloads";
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

function ensureBinary() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(YTDLP_PATH)) {
      try {
        const stats = fs.statSync(YTDLP_PATH);
        if (stats.size > 1000000) {
          fs.chmodSync(YTDLP_PATH, 0o755);
          console.log(`✅ yt-dlp already installed (${(stats.size / 1048576).toFixed(1)} MB)`);
          resolve();
          return;
        } else {
          console.log("⚠️ Found broken yt-dlp file, deleting...");
          fs.unlinkSync(YTDLP_PATH);
        }
      } catch (e) {
        console.error("⚠️ Error checking existing binary:", e.message);
      }
    }

    console.log("⬇️ Downloading yt-dlp binary...");
    const file = fs.createWriteStream(YTDLP_PATH);

    function download(url) {
      https.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          download(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          if (fs.existsSync(YTDLP_PATH)) fs.unlinkSync(YTDLP_PATH);
          reject(`Failed to download yt-dlp: ${res.statusCode}`);
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          try {
            fs.chmodSync(YTDLP_PATH, 0o755);
            const stats = fs.statSync(YTDLP_PATH);
            if (stats.size < 1000000) {
              fs.unlinkSync(YTDLP_PATH);
              reject("Downloaded yt-dlp file too small, download broken.");
              return;
            }
            console.log(`✅ yt-dlp installed (${(stats.size / 1048576).toFixed(1)} MB)`);
            resolve();
          } catch (e) {
            if (fs.existsSync(YTDLP_PATH)) fs.unlinkSync(YTDLP_PATH);
            reject("⚠️ Failed to finalize yt-dlp binary: " + e.message);
          }
        });
      }).on("error", (err) => {
        if (fs.existsSync(YTDLP_PATH)) fs.unlinkSync(YTDLP_PATH);
        reject(err);
      });
    }

    download(YTDLP_URL);
  });
}

function runYtdlp(args) {
  return new Promise((resolve, reject) => {
    const fullArgs = ["--cookies", COOKIES_FILE, ...args];
    execFile(YTDLP_PATH, fullArgs, (err, stdout, stderr) => {
      if (err) reject(stderr || err.message);
      else resolve(stdout);
    });
  });
}

function getStandardQuality(f) {
  if (f.vcodec === "none") return "audio only";
  if (f.height <= 144) return "144p";
  if (f.height <= 240) return "240p";
  if (f.height <= 360) return "360p";
  if (f.height <= 480) return "480p";
  if (f.height <= 720) return "720p";
  if (f.height <= 1080) return "1080p";
  if (f.height <= 1440) return "1440p";
  if (f.height <= 2160) return "2160p (4K)";
  return `${f.height}p`;
}

function filterFormats(formats) {
  const videoGroups = {};
  const audio = [];

  for (const f of formats) {
    if (!f.filesize) continue;
    if (f.vcodec === "none") audio.push(f);
    else {
      const q = getStandardQuality(f);
      if (!videoGroups[q]) videoGroups[q] = [];
      videoGroups[q].push(f);
    }
  }

  const videos = [];
  for (const q in videoGroups) {
    const arr = videoGroups[q].sort((a, b) => a.filesize - b.filesize);
    const mp4 = arr.find(f => f.ext === "mp4");
    videos.push(mp4 || arr[0]);
  }

  return [...videos, ...audio];
}

function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>$]/g, "_");
}

async function mergeWithFfmpeg(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_PATH, [
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "libfdk_aac",
      "-profile:a", "aac_he",
      "-b:a", "30k",
      "-ac", "2",
      "-ar", "44100",
      "-fflags", "+genpts",
      "-y",
      outputPath
    ], (err, stdout, stderr) => {
      if (err) {
        console.error("FFmpeg stderr:", stderr);
        reject(stderr || err.message);
      } else resolve(stdout);
    });
  });
}

async function main() {
  try {
    await ensureBinary();
  } catch (err) {
    console.error("❌ Could not set up yt-dlp:", err);
    return;
  }

  const url = await ask("👉 Enter YouTube URL: ");
  console.log("🔍 Fetching formats...\n");

  let info;
  try {
    const json = await runYtdlp(["-J", url]);
    info = JSON.parse(json);
  } catch (e) {
    console.error("❌ Failed to fetch video info:", e.message);
    return;
  }

  const formats = filterFormats(info.formats);
  formats.forEach((f, i) => {
    const sizeMB = f.filesize ? (f.filesize / 1048576).toFixed(1) : "?";
    const tag = f.vcodec === "none" ? "🎵" : "⭐";
    console.log(`[${i}] ${tag} ${getStandardQuality(f)} | ${f.ext.toUpperCase()} | ${sizeMB} MB | id=${f.format_id} | acodec=${f.acodec}`);
  });

  const choice = await ask("\n👉 Pick video format to download: ");
  const selected = formats[parseInt(choice)];
  if (!selected || selected.vcodec === "none") return console.log("❌ Invalid choice (pick a video format, not audio)");

  const audioFormats = formats.filter(f => f.vcodec === "none");
  if (audioFormats.length === 0) return console.log("❌ No audio formats found");
  const smallestAudio = audioFormats.sort((a, b) => (a.filesize || Infinity) - (b.filesize || Infinity))[0];

  const videoTemp = path.join(OUTPUT_DIR, "video_temp." + selected.ext);
  const audioTemp = path.join(OUTPUT_DIR, "audio_temp." + smallestAudio.ext);

  try {
    console.log("⬇️ Downloading video...");
    await runYtdlp(["-f", selected.format_id, "-o", videoTemp, url]);

    console.log("⬇️ Downloading smallest audio...");
    await runYtdlp(["-f", smallestAudio.format_id, "-o", audioTemp, url]);

    const safeTitle = sanitizeFilename(info.title);
    const finalOutput = path.join(OUTPUT_DIR, `${safeTitle}-${info.id}.mp4`);

    console.log("🔀 Merging video + audio with HE-AAC 30k CBR...");
    await mergeWithFfmpeg(videoTemp, audioTemp, finalOutput);

    console.log(`✅ Download complete! File saved at ${finalOutput}`);

    console.log("🔍 Checking output file details...");
    execFile(FFPROBE_PATH, [
      "-v", "quiet",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,bit_rate,channels,sample_rate,profile",
      "-of", "csv=p=0",
      finalOutput
    ], (err, stdout) => {
      if (!err) console.log(`📊 Audio stream info: ${stdout}`);
    });
  } catch (err) {
    console.error("❌ Error during download/merge:", err);
  } finally {
    if (fs.existsSync(videoTemp)) fs.unlinkSync(videoTemp);
    if (fs.existsSync(audioTemp)) fs.unlinkSync(audioTemp);
  }
}

main();