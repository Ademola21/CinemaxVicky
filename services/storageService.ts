
import { User } from './types';

/**
 * NOTE: This service has been refactored into a secure API client. It no longer stores
 * user accounts, watchlists, or history in localStorage. Instead, it makes authenticated
 * requests to a new server-side API endpoint (/api/users) which manages the data centrally.
 * This ensures user data is persistent, secure, and accessible across all devices.
 *
 * Session tokens are still managed here using localStorage, which is a standard and correct practice.
 */


// --- API HELPERS ---
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/users${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'An API error occurred');
    }
    return data;
};

// --- SESSION MANAGEMENT (Client-Side) ---
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days

export const createSession = (sessionData: { token: string, user: User }): void => {
    const expires = Date.now() + SESSION_DURATION;
    localStorage.setItem('YC_SESSION', JSON.stringify({ ...sessionData, expires }));
};

export const getSession = (): { token: string, user: User, expires: number } | null => {
    const sessionStr = localStorage.getItem('YC_SESSION');
    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);
    if (session && session.expires > Date.now()) {
        return session;
    }
    clearSession();
    return null;
};

export const clearSession = (): void => localStorage.removeItem('YC_SESSION');


// --- USER MANAGEMENT (Server-Side API Calls) ---
export const signup = async (name: string, email: string, password: string, username: string): Promise<User> => {
    const { user, token } = await apiFetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, username }),
    });
    createSession({ user, token });
    return user;
};

export const login = async (email: string, password: string): Promise<User> => {
    const { user, token } = await apiFetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    createSession({ user, token });
    return user;
};

export const isUsernameTaken = (username: string, excludeUserId?: string): Promise<boolean> => {
    // This validation logic is now handled by the backend during signup/update.
    // This client-side check is removed as the server is the source of truth.
    return Promise.resolve(false); 
};


export const updateUserProfile = async (updates: Partial<Pick<User, 'name' | 'username' | 'profilePic'>>): Promise<User> => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');

    const { user, token } = await apiFetch('/profile', {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(updates),
    });
    // Refresh the session with the updated user data
    createSession({ user, token });
    return user;
};


// --- WATCHLIST & HISTORY (Server-Side API Calls) ---

interface UserData {
    watchlist: string[];
    history: { movieId: string, viewedAt: string }[];
}

export const getUserData = async (): Promise<UserData> => {
    const session = getSession();
    if (!session) return { watchlist: [], history: [] };
    
    return apiFetch('/data', {
        headers: { 'Authorization': `Bearer ${session.token}` }
    });
};

export const toggleWatchlist = async (movieId: string): Promise<string[]> => {
    const session = getSession();
    if (!session) throw new Error('Not authenticated');
    
    const { watchlist } = await apiFetch('/watchlist', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ movieId }),
    });
    return watchlist;
};

export const addToViewingHistory = async (movieId: string): Promise<void> => {
    const session = getSession();
    if (!session) return; // Fail silently for history

    try {
        await apiFetch('/history', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({ movieId }),
        });
    } catch (error) {
        console.warn("Could not save viewing history:", error);
    }
};


// --- DEPRECATED MIGRATION LOGIC (No longer needed) ---
// The original initializeData and user retrieval functions are removed
// as all user data is now managed by the secure backend.
