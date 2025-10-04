import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/Icons';

interface Announcement {
    message: string;
    active: boolean;
}

const AnnouncementBanner: React.FC = () => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                const response = await fetch(`/api/announcement?v=${new Date().getTime()}`);
                if (response.ok) {
                    const data: Announcement = await response.json();
                    if (data.active && data.message) {
                        const dismissedId = `announcementDismissed_${data.message.slice(0, 20)}`;
                        if (!sessionStorage.getItem(dismissedId)) {
                             setAnnouncement(data);
                             setIsVisible(true);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch announcement:", error);
            }
        };

        fetchAnnouncement();
    }, []);

    const handleDismiss = () => {
        if (announcement) {
            const dismissedId = `announcementDismissed_${announcement.message.slice(0, 20)}`;
            sessionStorage.setItem(dismissedId, 'true');
        }
        setIsVisible(false);
    };

    if (!isVisible || !announcement) {
        return null;
    }

    return (
        <div className="relative bg-gradient-to-r from-green-500 to-blue-600 text-white text-center py-2 px-8 z-50">
            <p className="text-sm font-medium">{announcement.message}</p>
            <button
                onClick={handleDismiss}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-full hover:bg-black/20 transition-colors"
                aria-label="Dismiss announcement"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

export default AnnouncementBanner;