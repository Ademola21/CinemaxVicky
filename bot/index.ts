
// This file acts as a gatekeeper to prevent the bot from running in unsupported environments.

// Check 1: Ensure we are in a Node.js environment, not a browser.
const isNodeEnvironment = typeof window === 'undefined';

// Check 2: Ensure the essential environment variables are set.
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const youtubeKey = process.env.YOUTUBE_API_KEY;

if (isNodeEnvironment && telegramToken && youtubeKey) {
  // If all checks pass, load and run the main bot logic.
  console.log("Node.js environment and all required API keys detected. Starting bot...");
  require('./run'); 
} else {
  // If checks fail, log an informative message and do nothing.
  if (!isNodeEnvironment) {
    console.log("Skipping Telegram bot launch: Detected browser environment.");
  } else {
    if (!telegramToken) {
      console.log("Skipping Telegram bot launch: TELEGRAM_BOT_TOKEN is not set.");
    }
    if (!youtubeKey) {
       console.log("Skipping Telegram bot launch: YOUTUBE_API_KEY is not set.");
    }
    console.log("This is the expected behavior on development platforms without backend secrets.");
  }
}