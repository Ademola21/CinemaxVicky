
import React, { useState, useEffect } from 'react';
// FIX: react-router-dom v5 uses useLocation instead of useSearchParams.
import { useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { LinkIcon, DownloadIcon } from '../components/icons/Icons';
import { getYouTubeVideoInfo, getDownloadUrl, connectToProgressStream, extractDownloadId } from '../services/youtubeService';

interface DownloadOption {
  format_id: string;
  resolution: string;
  ext: string;
  filesize?: number;
  actualFilesize?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
}

interface VideoDetails {
  id: string;
  thumbnail: string;
  title: string;
  channel: string;
  videoOptions: DownloadOption[];
  audioOptions: DownloadOption[];
}

interface ProgressInfo {
  formatId: string;
  stage: 'preparing' | 'downloading' | 'merging' | 'complete';
  progress?: number;
  speed?: string;
  eta?: string;
}

// Modern Modal Component for Format Selection
const FormatModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  options: DownloadOption[];
  title: string;
  onDownload: (formatId: string) => void;
  downloadingFormat?: string;
  progressInfo?: ProgressInfo;
}> = ({ isOpen, onClose, options, title, onDownload, downloadingFormat, progressInfo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Progress Info */}
        {progressInfo && (
          <div className="p-6 border-b border-gray-700 bg-blue-900/20">
            <div className="text-blue-300 mb-2 font-medium">
              {progressInfo.stage === 'preparing' && 'Preparing download...'}
              {progressInfo.stage === 'downloading' && 'Downloading video...'}
              {progressInfo.stage === 'merging' && 'Merging video with audio...'}
              {progressInfo.stage === 'complete' && 'Download ready!'}
            </div>
            {progressInfo.progress !== undefined && (
              <div className="bg-gray-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressInfo.progress}%` }}
                ></div>
              </div>
            )}
            {(progressInfo.speed || progressInfo.eta) && (
              <div className="text-sm text-gray-400">
                {progressInfo.speed && <span>Speed: {progressInfo.speed}</span>}
                {progressInfo.speed && progressInfo.eta && <span className="mx-2">•</span>}
                {progressInfo.eta && <span>ETA: {progressInfo.eta}</span>}
              </div>
            )}
          </div>
        )}

        {/* Format List */}
        <div className="max-h-96 overflow-y-auto">
          {options.map((option, index) => {
            const sizeMB = option.actualFilesize || option.filesize ? 
              ((option.actualFilesize || option.filesize!) / 1048576).toFixed(1) : "?";
            
            // Format resolution display
            let displayResolution = option.resolution;
            if (option.isAudioOnly) {
              displayResolution = "Audio Only";
            } else if (option.resolution && option.resolution !== 'audio only') {
              if (option.resolution.includes('x')) {
                const height = option.resolution.split('x')[1];
                displayResolution = `${height}p`;
              } else {
                displayResolution = option.resolution;
              }
            }
            
            const isDownloading = downloadingFormat === option.format_id;
            
            return (
              <div key={index} className="border-b border-gray-700/50 last:border-b-0">
                <div className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex-grow">
                    <div className="text-white font-medium mb-1">
                      {displayResolution}
                    </div>
                    <div className="text-sm text-gray-400">
                      {option.ext.toUpperCase()} • {sizeMB} MB
                    </div>
                  </div>
                  <button
                    onClick={() => onDownload(option.format_id)}
                    disabled={!!downloadingFormat}
                    className={`ml-4 inline-flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-all ${
                      isDownloading 
                        ? 'bg-blue-600 text-white cursor-not-allowed' 
                        : downloadingFormat
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105'
                    }`}
                  >
                    <DownloadIcon className="w-4 h-4" />
                    {isDownloading ? 'Downloading...' : 'Download'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DownloadSection: React.FC<{ title: string; options: DownloadOption[]; onShowModal: (title: string, options: DownloadOption[]) => void }> = ({ title, options, onShowModal }) => (
    <div className="mt-8">
        <button
          onClick={() => onShowModal(title, options)}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-1">{title}</h3>
              <p className="text-blue-100 text-sm">{options.length} format{options.length !== 1 ? 's' : ''} available</p>
            </div>
            <div className="text-2xl">→</div>
          </div>
        </button>
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
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOptions, setModalOptions] = useState<DownloadOption[]>([]);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);

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
      const result = await getYouTubeVideoInfo(videoUrl);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to process this video.');
      }

      const { info, processedFormats } = result.data;

      // Separate video and audio formats
      const videoFormats = processedFormats.filter(f => f.hasVideo && !f.isAudioOnly);
      const audioFormats = processedFormats.filter(f => f.isAudioOnly);

      // Sort video formats by resolution (highest first)
      const sortedVideoFormats = videoFormats.sort((a, b) => {
        const getResolutionHeight = (res: string) => {
          if (res.includes('x')) {
            return parseInt(res.split('x')[1], 10);
          }
          return parseInt(res.replace(/[a-zA-Z]/g, ''), 10) || 0;
        };
        return getResolutionHeight(b.resolution) - getResolutionHeight(a.resolution);
      });

      // Sort audio formats by filesize (highest first)
      const sortedAudioFormats = audioFormats.sort((a, b) => 
        (b.actualFilesize || b.filesize || 0) - (a.actualFilesize || a.filesize || 0)
      );

      setVideoDetails({
        id: info.id,
        thumbnail: info.thumbnail,
        title: info.title,
        channel: info.uploader || 'YouTube',
        videoOptions: sortedVideoFormats,
        audioOptions: sortedAudioFormats
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowModal = (title: string, options: DownloadOption[]) => {
    setModalTitle(title);
    setModalOptions(options);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    // Only allow closing if not currently downloading
    if (!downloadingFormat) {
      setModalOpen(false);
      setProgressInfo(null);
    }
  };

  const handleDownload = async (formatId: string) => {
    if (!url || downloadingFormat) return;

    setDownloadingFormat(formatId);
    setProgressInfo({
      formatId,
      stage: 'preparing',
      progress: 0
    });

    let progressStreamCleanup: (() => void) | null = null;
    let downloadTimeout: NodeJS.Timeout | null = null;

    try {
      // First get the download URL and extract ID
      const result = await getDownloadUrl(url, formatId);
      
      if (!result.success || !result.downloadUrl) {
        throw new Error(result.error || 'Failed to get download URL');
      }

      const downloadId = extractDownloadId(result.downloadUrl);
      
      if (downloadId) {
        console.log('🔗 Connecting to progress stream for download:', downloadId);
        
        // Connect to progress stream BEFORE starting download
        progressStreamCleanup = connectToProgressStream(
          downloadId,
          (progressData) => {
            console.log('📊 Progress update received:', progressData);
            
            // Clear any existing timeout when we receive progress updates
            if (downloadTimeout) {
              clearTimeout(downloadTimeout);
              downloadTimeout = null;
            }
            
            setProgressInfo({
              formatId,
              stage: progressData.stage || 'downloading',
              progress: progressData.progress,
              speed: progressData.speed,
              eta: progressData.eta
            });
            
            // Set a new timeout if we're still in progress
            if (progressData.stage !== 'complete' && progressData.stage !== 'error') {
              downloadTimeout = setTimeout(() => {
                console.warn('⏰ No progress update received for 2 minutes, retrying connection...');
                setProgressInfo(prev => ({
                  ...prev!,
                  stage: 'preparing'
                }));
              }, 120000); // 2 minute timeout
            }
          },
          (error) => {
            console.error('📡 Progress stream error:', error);
            setError('Connection to progress stream failed. Download may still be processing...');
          },
          () => {
            console.log('✅ Progress stream completed');
            if (downloadTimeout) clearTimeout(downloadTimeout);
            setTimeout(() => {
              setModalOpen(false);
              setProgressInfo(null);
            }, 1500);
          }
        );

        // Give the progress stream a moment to connect properly
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('📊 Progress stream connected, starting download...');
        setProgressInfo(prev => ({
          ...prev!,
          stage: 'downloading',
          progress: 0
        }));
      }

      // Now start the download with the connected progress stream
      console.log('🚀 Starting download:', result.downloadUrl);
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename || 'video.mp4';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start download';
      setError(errorMsg);
      console.error('❌ Download error:', err);
      
      if (progressStreamCleanup) {
        progressStreamCleanup();
      }
      if (downloadTimeout) {
        clearTimeout(downloadTimeout);
      }
      
      setTimeout(() => {
        setModalOpen(false);
        setProgressInfo(null);
      }, 3000);
    } finally {
      setDownloadingFormat(null);
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
          Paste any YouTube link below to get your download options. Video-only formats automatically merge with best audio.
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
          <LoadingSpinner text="Analyzing video..." />
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

          {videoDetails.videoOptions.length > 0 && (
            <DownloadSection 
              title="Complete (Video + Audio)" 
              options={videoDetails.videoOptions} 
              onShowModal={handleShowModal}
            />
          )}

          {videoDetails.audioOptions.length > 0 && (
            <DownloadSection 
              title="Audio Only" 
              options={videoDetails.audioOptions} 
              onShowModal={handleShowModal}
            />
          )}

          {videoDetails.videoOptions.length === 0 && videoDetails.audioOptions.length === 0 && (
            <div className="mt-8 text-center text-gray-400">
                <p>No download options could be found for this video.</p>
            </div>
          )}
        </section>
      )}

      {/* Format Selection Modal */}
      <FormatModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        options={modalOptions}
        title={modalTitle}
        onDownload={handleDownload}
        downloadingFormat={downloadingFormat || undefined}
        progressInfo={progressInfo || undefined}
      />
    </div>
  );
};

export default YouTubeDownloaderPage;
