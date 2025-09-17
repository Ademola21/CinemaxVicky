// FIX: Declare '__dirname' to resolve TypeScript error about missing Node.js type definitions.
declare const __dirname: string;

import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(__dirname, '../data/analyticsLog.json');

type LogEntry = {
    type: 'VISIT' | 'SIGNUP' | 'MOVIE_CLICK';
    timestamp: string;
    payload?: {
        movieId?: string;
        movieTitle?: string;
    };
};

const readLog = (): LogEntry[] => {
    try {
        if (!fs.existsSync(LOG_PATH)) return [];
        const data = fs.readFileSync(LOG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading analyticsLog.json:", error);
        return [];
    }
};

const writeLog = (log: LogEntry[]) => {
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
};

// --- "REAL" DATA SIMULATION ---
// This simulates frontend activity for the Telegram bot's analytics.
// NOTE: This is separate from the frontend's actual localStorage-based analytics.
const logEvent = (entry: Omit<LogEntry, 'timestamp'>) => {
    const log = readLog();
    const newEntry: LogEntry = { ...entry, timestamp: new Date().toISOString() };
    log.push(newEntry);
    if (log.length > 500) log.shift(); // Keep log size manageable
    writeLog(log);
};

// Simulate some traffic for demonstration purposes to make bot analytics look active.
const sampleMovieTitles = ["Jagun Jagun (The Warrior)", "Aníkúlápó", "King of Thieves (Ogundabede)", "Gangs of Lagos"];
setInterval(() => {
    // Simulate a few visits
    for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
        logEvent({ type: 'VISIT' });
    }
    // Simulate a chance of a signup
    if (Math.random() < 0.1) {
        logEvent({ type: 'SIGNUP' });
    }
    // Simulate a few movie clicks
    for (let i = 0; i < Math.floor(Math.random() * 3); i++) {
        const movieTitle = sampleMovieTitles[Math.floor(Math.random() * sampleMovieTitles.length)];
        logEvent({ type: 'MOVIE_CLICK', payload: { movieTitle } });
    }
}, 3 * 60 * 1000); // Simulate activity every 3 minutes.


// --- ANALYTICS DATA RETRIEVAL ---

export const getAnalyticsSummary = (timeframeDays: number = 1) => {
    const log = readLog();
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

    const recentLogs = log.filter(entry => new Date(entry.timestamp) > cutoff);

    const dailyVisitors = recentLogs.filter(e => e.type === 'VISIT').length;
    const todaysSignups = recentLogs.filter(e => e.type === 'SIGNUP').length;
    
    const movieClicks = new Map<string, number>();
    recentLogs.forEach(entry => {
        if (entry.type === 'MOVIE_CLICK' && entry.payload?.movieTitle) {
            const title = entry.payload.movieTitle;
            movieClicks.set(title, (movieClicks.get(title) || 0) + 1);
        }
    });

    const mostClicked = Array.from(movieClicks.entries())
        .map(([title, clicks]) => ({ title, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

    return {
        dailyVisitors,
        todaysSignups,
        mostClicked,
        totalEvents: recentLogs.length
    };
};
