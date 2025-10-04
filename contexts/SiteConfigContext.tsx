

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '../services/types';

interface SiteConfigContextType {
    config: SiteConfig;
    loading: boolean;
    error: string | null;
}

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

const defaultConfig: SiteConfig = {
    name: "Yoruba Cinemax",
    tagline: "Nigeria's Premier Yoruba Movie Destination",
    featuredMovieId: null,
    liveTvEnabled: false,
    liveTvUrl: "",
    copyrightYear: new Date().getFullYear().toString(),
    contact: {
        email: "support@example.com",
        phone: "+1-234-567-890",
        address: "123 Movie Lane, Film City"
    },
    socials: []
};

export const SiteConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<SiteConfig>(defaultConfig);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Use the secure API endpoint instead of direct file access
                const response = await fetch(`/api/site-config?v=${new Date().getTime()}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch site configuration.');
                }
                const data = await response.json();
                setConfig(prev => ({ ...prev, ...data })); // Merge with defaults
                document.title = `${data.name} - ${data.tagline}`;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
                console.error("Could not load site config, using defaults:", err);
                setConfig(defaultConfig); // Ensure config is set to default on error
                document.title = `${defaultConfig.name} - ${defaultConfig.tagline}`;
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    return (
        <SiteConfigContext.Provider value={{ config, loading, error }}>
            {children}
        </SiteConfigContext.Provider>
    );
};

export const useSiteConfig = (): SiteConfigContextType => {
    const context = useContext(SiteConfigContext);
    if (context === undefined) {
        throw new Error('useSiteConfig must be used within a SiteConfigProvider');
    }
    return context;
};
