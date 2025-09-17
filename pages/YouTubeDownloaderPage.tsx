import React, { useState, useEffect } from 'react';
// FIX: react-router-dom v5 uses useLocation instead of useSearchParams.
import { useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { LinkIcon, DownloadIcon } from '../components/icons/Icons';

// The third-party API endpoint that will process the YouTube URL.
const DOWNLOADER_API_ENDPOINT = '/api/youtube-downloader';

interface DownloadOption {
  url: string;
  label: string; // e.g., "1080p" or "128kbps"
  format: string; // e.g., "MP4", "M4A"
  type: 'Video + Audio' | 'Audio Only' | 'Video Only';
}

interface VideoDetails {
  thumbnail: string;
  title: string;
  channel: string;
  completeOptions: DownloadOption[];
  videoOnlyOptions: DownloadOption[];
  audioOnlyOptions: DownloadOption[];
}

const DownloadSection: React.FC<{ title: string; options: DownloadOption[]; children?: React.ReactNode }> = ({ title, options, children }) => (
    <div className="mt-8">
        <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {options.map((option, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4 flex flex-col items-center text-center border border-gray-600/50">
                    <span className="text-lg font-bold text-green-400">{option.label}</span>
                    <span className="text-sm text-gray-300">{option.format}</span>
                    <a
                        href={option.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-auto inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-500 transition-colors mt-3"
                        download
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </a>
                </div>
            ))}
        </div>
        {children}
    </div>
);


const YouTubeDownloaderPage: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const urlFromQuery = params.get('url');

  const [url, setUrl] = useState(urlFromQuery || '');
  const [isLoading, setIsLoading] = useState(false);
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVideoFetch = async (videoUrl: string) => {
    if (!videoUrl.trim()) return;

    // Basic regex to check for a YouTube link pattern
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(videoUrl)) {
      setError('Invalid YouTube URL. Please check the link and try again.');
      setVideoDetails(null);
      return;
    }

    setIsLoading(true);
    setVideoDetails(null);
    setError(null);

    try {
      // Get session from storage
      const sessionStr = localStorage.getItem('YC_SESSION');
      let session = null;
      if (sessionStr) {
        try {
          session = JSON.parse(sessionStr);
        } catch (e) {
          console.warn('Failed to parse session:', e);
        }
      }

      const response = await fetch(DOWNLOADER_API_ENDPOINT, {
          method: 'POST',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: videoUrl, session })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 503) {
          throw new Error(errorData.error || 'The YouTube downloader service is temporarily unavailable. Please try again in a few minutes.');
        }
        throw new Error(errorData.error || 'The downloader service is currently unavailable. Please try again later.');
      }

      const data = await response.json();

      if (data.status !== 'success' && data.status !== 'stream') {
        throw new Error(data.text || 'Failed to process this video. It may be private, age-restricted, or a live stream.');
      }

      const allOptions: DownloadOption[] = (data.picker || [])
        .map((item: any) => {
            let type: DownloadOption['type'] = 'Video Only';
            if (item.audio) {
                type = 'Video + Audio';
            } else if (item.type === 'audio') {
                type = 'Audio Only';
            }

            return {
                url: item.url,
                label: item.quality ? (item.type === 'audio' ? `${item.quality}` : `${item.quality}p`) : 'Audio',
                format: item.format ? item.format.toUpperCase() : 'N/A',
                type: type,
            };
        })
        .filter((opt: DownloadOption) => opt.url);

      if (data.status === 'success' && data.url && !allOptions.some(opt => opt.url === data.url)) {
          allOptions.unshift({
              url: data.url,
              label: 'Best Quality',
              format: 'MP4',
              type: 'Video + Audio',
          });
      }

      const qualityToNumber = (label: string) => parseInt(label.replace(/[a-zA-Z]/g, ''), 10) || 0;

      const completeOptions = allOptions
        .filter(opt => opt.type === 'Video + Audio')
        .sort((a, b) => qualityToNumber(b.label) - qualityToNumber(a.label));

      const videoOnlyOptions = allOptions
        .filter(opt => opt.type === 'Video Only')
        .sort((a, b) => qualityToNumber(b.label) - qualityToNumber(a.label));

      const audioOnlyOptions = allOptions
        .filter(opt => opt.type === 'Audio Only')
        .sort((a, b) => qualityToNumber(b.label) - qualityToNumber(a.label));


      setVideoDetails({
        thumbnail: data.thumbnail,
        title: data.title,
        channel: data.author || 'YouTube',
        completeOptions,
        videoOnlyOptions,
        audioOnlyOptions,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVideoFetch(url);
  };

  useEffect(() => {
    if (urlFromQuery) {
      setUrl(urlFromQuery);
      handleVideoFetch(urlFromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFromQuery]);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <BackButton />
      <section className="text-center animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          YouTube Video Downloader
        </h1>
        <p className="text-gray-300 mt-2 max-w-2xl mx-auto">
          Paste any YouTube link below to get your download options. This feature is now fully functional.
        </p>
      </section>

      <section className="mt-12">
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LinkIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-green-500/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Fetching...' : 'Fetch Video'}
          </button>
        </form>
      </section>

      {error && (
        <div className="mt-8 text-center p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
            <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {isLoading && (
        <div className="mt-12 flex justify-center">
          <LoadingSpinner text="Analyzing link..." />
        </div>
      )}

      {videoDetails && (
        <section className="mt-12 animate-fade-in bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <img 
              src={videoDetails.thumbnail} 
              alt="Video thumbnail" 
              className="w-full md:w-64 h-auto object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              onLoad={(e) => {
                e.currentTarget.style.display = 'block';
              }}
            />
            <div className="flex-grow">
              <p className="text-sm text-gray-400">{videoDetails.channel}</p>
              <h2 className="text-2xl font-bold text-white mt-1">{videoDetails.title}</h2>
            </div>
          </div>

          {videoDetails.completeOptions.length > 0 && (
            <DownloadSection title="Complete (Video + Audio)" options={videoDetails.completeOptions} />
          )}

          {videoDetails.videoOnlyOptions.length > 0 && (
            <DownloadSection title="Highest Quality (Video Only)" options={videoDetails.videoOnlyOptions}>
                <div className="p-3 mt-4 bg-gray-900/50 rounded-md border border-gray-600/50">
                    <p className="text-xs text-gray-400 text-center">
                        <span className="font-bold">Pro Tip:</span> For the best quality, YouTube serves video and audio separately. Download a video from this section and a track from "Audio Only," then combine them with free desktop software like <a href="https://www.videolan.org/vlc/" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">VLC</a> or HandBrake.
                    </p>
                </div>
            </DownloadSection>
          )}

          {videoDetails.audioOnlyOptions.length > 0 && (
            <DownloadSection title="Audio Only" options={videoDetails.audioOnlyOptions} />
          )}

          {videoDetails.completeOptions.length === 0 && videoDetails.videoOnlyOptions.length === 0 && (
            <div className="mt-8 text-center text-gray-400">
                <p>No direct download links could be found for this video.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default YouTubeDownloaderPage;