#!/usr/bin/env node

/**
 * Setup script to ensure yt-dlp binary is available
 * This runs during npm install to download the latest yt-dlp binary
 */

// Import the compiled JavaScript version
let ytdlpManager;
try {
  // Try to import from compiled dist folder
  const { ytdlpManager: manager } = require('../dist/services/ytdlpBinaryManager');
  ytdlpManager = manager;
} catch (error) {
  console.error('❌ Failed to import yt-dlp binary manager:', error.message);
  console.log('⚠️  Make sure the project is built before running this script');
  process.exit(1);
}

async function setupYtDlp() {
  console.log('🔧 Setting up yt-dlp binary...');
  
  try {
    // Check for updates
    const updateCheck = await ytdlpManager.checkForUpdates();
    if (updateCheck.hasUpdate) {
      console.log(`📋 New yt-dlp version available: ${updateCheck.latestVersion}`);
      console.log('⚠️  Consider updating the ytdlpBinaryManager.ts to use the latest version');
    }

    // Ensure binary is available
    await ytdlpManager.ensureBinary();
    console.log('✅ yt-dlp binary setup completed successfully');
    
  } catch (error) {
    console.error('❌ Failed to setup yt-dlp binary:', error.message);
    console.log('⚠️  The application may not work properly without yt-dlp');
    // Don't fail the install process, just warn
    process.exit(0);
  }
}

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  setupYtDlp();
}

module.exports = { setupYtDlp };