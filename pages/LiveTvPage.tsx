
import React, { useEffect, useRef } from 'react';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import BackButton from '../components/BackButton';
import { FilmIcon } from '../components/icons/Icons';

// Since HLS.js is loaded from a CDN, we need to declare it for TypeScript
declare const Hls: any;

const LiveTvPage: React.FC = () => {
    const { config, loading } = useSiteConfig();
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsInstance = useRef<any>(null);

    useEffect(() => {
        if (loading || !config.liveTvEnabled || !config.liveTvUrl) {
            if (hlsInstance.current) {
                hlsInstance.current.destroy();
                hlsInstance.current = null;
            }
            return;
        }

        const videoElement = videoRef.current;
        if (!videoElement) return;

        if (Hls.isSupported()) {
            if (hlsInstance.current) {
                hlsInstance.current.destroy();
            }
            const hls = new Hls();
            hlsInstance.current = hls;
            hls.loadSource(config.liveTvUrl);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoElement.play().catch(e => console.error("Autoplay was prevented:", e));
            });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support on Safari
            videoElement.src = config.liveTvUrl;
            videoElement.addEventListener('loadedmetadata', () => {
                videoElement.play().catch(e => console.error("Autoplay was prevented:", e));
            });
        }
        
        return () => {
            if (hlsInstance.current) {
                hlsInstance.current.destroy();
                hlsInstance.current = null;
            }
        };

    }, [config.liveTvUrl, config.liveTvEnabled, loading]);

    if (loading) {
        return (
            <div className="animate-fade-in">
                <BackButton />
                <div className="flex justify-center items-center h-64">
                    <div className="text-white">Loading Live TV...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <BackButton />
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                    Live TV
                </h1>
                <p className="text-gray-300 mt-2">
                    {config.liveTvEnabled ? "Yoruba Cinemax Live Broadcast" : "Live TV is currently offline."}
                </p>
            </div>

            {config.liveTvEnabled && config.liveTvUrl ? (
                <div className="aspect-video w-full max-w-5xl mx-auto bg-black rounded-lg overflow-hidden border-2 border-gray-700 shadow-2xl">
                    <video
                        ref={videoRef}
                        controls
                        playsInline
                        className="w-full h-full"
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-lg max-w-5xl mx-auto">
                    <FilmIcon className="w-16 h-16 text-gray-600 mb-4" />
                    <h2 className="text-2xl font-bold text-white">Broadcast Offline</h2>
                    <p className="text-gray-400 mt-2">Please check back later.</p>
                </div>
            )}
        </div>
    );
};

export default LiveTvPage;
