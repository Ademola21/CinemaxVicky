// Test YouTube downloader API
require('dotenv').config();

async function testYouTubeDownloader() {
    try {
        console.log('🧪 Testing YouTube Downloader API...');
        
        // Create a fake session for testing
        const session = {
            user: { id: 'test-user' },
            token: 'test-token',
            expires: Date.now() + 3600000
        };
        
        const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
        
        const response = await fetch('http://localhost:5000/api/youtube-downloader', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url: testUrl,
                session: session
            })
        });
        
        const result = await response.json();
        
        console.log('📊 Response status:', response.status);
        console.log('📄 Response:', result);
        
        if (result.success) {
            console.log('✅ YouTube downloader API is working!');
            console.log('🎬 Video:', result.info?.title);
            console.log('📹 Video formats:', result.videoFormats?.length || 0);
            console.log('🎵 Audio formats:', result.audioFormats?.length || 0);
        } else {
            console.log('❌ YouTube downloader API failed:', result.error);
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

// Test the yt-dlp test endpoint too
async function testYtDlpEndpoint() {
    try {
        console.log('🔧 Testing yt-dlp test endpoint...');
        
        const response = await fetch('http://localhost:5000/api/test-ytdlp');
        const result = await response.json();
        
        console.log('📊 Test endpoint response:', response.status);
        console.log('📄 Test result:', result);
        
    } catch (error) {
        console.error('💥 Test endpoint failed:', error);
    }
}

async function runTests() {
    await testYtDlpEndpoint();
    console.log('---');
    await testYouTubeDownloader();
}

runTests().then(() => {
    console.log('🏁 Tests completed');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Tests crashed:', error);
    process.exit(1);
});