import readline from "readline";
import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";

const BIN_DIR = "./bin";
const YTDLP_PATH = path.resolve(BIN_DIR, "yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const OUTPUT_DIR = "./downloads"; // local folder for replit

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
          download(res.headers.location); // follow redirect
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
    execFile(YTDLP_PATH, args, (err, stdout, stderr) => {
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
    if (f.vcodec === "none") {
      audio.push(f);
    } else {
      const q = getStandardQuality(f);
      if (!videoGroups[q]) videoGroups[q] = [];
      videoGroups[q].push(f);
    }
  }

  const videos = [];
  for (const q in videoGroups) {
    let arr = videoGroups[q].sort((a, b) => a.filesize - b.filesize);
    const mp4 = arr.find(f => f.ext === "mp4");
    videos.push(mp4 || arr[0]);
  }

  audio.sort((a, b) => a.filesize - b.filesize);
  const audios = audio.length > 1 ? [audio[0], audio[audio.length - 1]] : audio;

  return [...videos, ...audios];
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

  try {
    const json = await runYtdlp(["-J", url]);
    let info;
    try {
      info = JSON.parse(json);
    } catch (e) {
      console.error("❌ Failed to parse JSON. Raw output:\n", json);
      return;
    }

    const formats = filterFormats(info.formats);

    formats.forEach((f, i) => {
      const sizeMB = f.filesize ? (f.filesize / 1048576).toFixed(1) : "?";
      const tag = f.vcodec === "none" ? "🎵" : "⭐";
      console.log(`[${i}] ${tag} ${getStandardQuality(f)} | ${f.ext.toUpperCase()} | ${sizeMB} MB | id=${f.format_id}`);
    });

    const choice = await ask("\n👉 Pick format to download: ");
    const selected = formats[parseInt(choice)];

    if (!selected) {
      console.log("❌ Invalid choice");
      return;
    }

    let formatOpt = selected.format_id;
    if (selected.vcodec && selected.acodec === "none" && formats.some(f => f.vcodec === "none")) {
      const lowestAudio = formats.filter(f => f.vcodec === "none")[0];
      formatOpt = `${selected.format_id}+${lowestAudio.format_id}`;
      console.log(`🎵 Merging with lowest audio (${lowestAudio.ext})`);
    }

    console.log(`\n⬇️ Downloading ${getStandardQuality(selected)}...`);
    await runYtdlp(["-f", formatOpt, "-o", `${OUTPUT_DIR}/%(title)s.%(ext)s`, url]);

    console.log("✅ Download complete! File saved in ./downloads/");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
