// Test yt-dlp binary download
console.log('🔧 Testing yt-dlp binary download...');

const { ytdlpManager } = require('./dist/services/ytdlpBinaryManager.js');

async function testDownload() {
    try {
        console.log('📥 Ensuring yt-dlp binary is available...');
        await ytdlpManager.ensureBinary();
        console.log('✅ yt-dlp binary is ready!');
        
        // Test a simple command
        console.log('🧪 Testing yt-dlp with --version command...');
        const output = await ytdlpManager.execute(['--version']);
        console.log('📋 yt-dlp version:', output.trim());
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDownload().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});