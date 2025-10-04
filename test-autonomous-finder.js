// Test script for Autonomous Finder
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_TELEGRAM_USER_ID;

if (!token || !adminId) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_USER_ID');
    process.exit(1);
}

console.log('🤖 Testing Autonomous Finder with your credentials...');
console.log(`Admin ID: ${adminId}`);

// Create bot instance
const bot = new TelegramBot(token, { polling: false });

// Test the channel processing function
async function testAutonomousFinder() {
    try {
        console.log('📹 Testing processNextBatchForChannel function...');
        
        // Import the function
        const { processNextBatchForChannel } = require('./dist/bot/movieManager.js');
        
        // Test channel URL - use a known Yoruba channel
        const testChannelUrl = 'https://youtube.com/@itelediconstudio/videos';
        
        console.log(`🎬 Testing with channel: ${testChannelUrl}`);
        
        // Call the function
        await processNextBatchForChannel(testChannelUrl, bot);
        
        console.log('✅ Test completed! Check the bot messages to see results.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testAutonomousFinder().then(() => {
    console.log('🏁 Test script finished');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Test script crashed:', error);
    process.exit(1);
});