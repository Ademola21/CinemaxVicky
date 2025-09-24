
/**
 * NOTE: This service logs user activity to localStorage for demonstration purposes.
 * This allows the in-page AI assistant to access real-time data for the admin.
 * In a production app, this would send data to a proper analytics backend.
 */

const ANALYTICS_LOG_KEY = 'YC_ANALYTICS_LOG';
const VISIT_LOGGED_KEY = 'YC_VISIT_LOGGED';

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
        const storedLog = localStorage.getItem(ANALYTICS_LOG_KEY);
        return storedLog ? JSON.parse(storedLog) : [];
    } catch (error) {
        console.error("Failed to read analytics log from localStorage", error);
        return [];
    }
};

const writeLog = (log: LogEntry[]) => {
    try {
        // Keep the log to a reasonable size to avoid filling up localStorage
        if (log.length > 1000) {
            log = log.slice(log.length - 1000);
        }
        localStorage.setItem(ANALYTICS_LOG_KEY, JSON.stringify(log));
    } catch (error) {
        console.error("Failed to write analytics log to localStorage", error);
    }
};

const logEvent = (entry: Omit<LogEntry, 'timestamp'>) => {
    const log = readLog();
    const newEntry: LogEntry = { ...entry, timestamp: new Date().toISOString() };
    log.push(newEntry);
    writeLog(log);
};

// --- Public API ---

/**
 * Logs a site visit. To avoid over-logging, this only logs once per session.
 */
export const logVisit = () => {
    if (!sessionStorage.getItem(VISIT_LOGGED_KEY)) {
        logEvent({ type: 'VISIT' });
        sessionStorage.setItem(VISIT_LOGGED_KEY, 'true');
    }
};

/**
 * Logs a new user signup event.
 */
export const logSignup = () => {
    logEvent({ type: 'SIGNUP' });
};

/**
 * Logs when a user views a movie's details page.
 * @param movieId The ID of the movie.
 * @param movieTitle The title of the movie.
 */
export const logMovieClick = (movieId: string, movieTitle: string) => {
    logEvent({ type: 'MOVIE_CLICK', payload: { movieId, movieTitle } });
};


/**
 * Reads the analytics log from localStorage and computes a summary.
 * This is used by the admin AI chat on the website.
 * @param timeframeDays The number of days to look back for the summary.
 */
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
