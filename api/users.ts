
import express from 'express';
const router = express.Router();
import path from 'path';
import { webcrypto, randomBytes } from 'crypto';
import { atomicWrite, validateGmail } from './utils';
// FIX: Added missing 'fs' import.
import fs from 'fs';

// --- DATABASE HELPERS ---
const USERS_PATH = path.resolve(__dirname, '../data/users.json');
const WATCHLISTS_PATH = path.resolve(__dirname, '../data/watchlists.json');
const HISTORY_PATH = path.resolve(__dirname, '../data/viewingHistory.json');

const readJsonFile = (filePath: string, defaultValue: any) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { return defaultValue; }
};

const getUsers = () => readJsonFile(USERS_PATH, []);
const getWatchlists = () => readJsonFile(WATCHLISTS_PATH, {});
const getHistories = () => readJsonFile(HISTORY_PATH, {});

const saveUsers = (users: any) => atomicWrite(USERS_PATH, JSON.stringify(users, null, 2));
const saveWatchlists = (watchlists: any) => atomicWrite(WATCHLISTS_PATH, JSON.stringify(watchlists, null, 2));
const saveHistories = (histories: any) => atomicWrite(HISTORY_PATH, JSON.stringify(histories, null, 2));

// --- SECURITY & HELPERS ---
async function hashPassword(password: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function createToken(userId: string) { return `${userId}:${randomBytes(16).toString('hex')}`; }
const sanitize = (str: string) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
function toPublicUser(user: any) { const { passwordHash, ...publicData } = user; return publicData; }

// Auth middleware for protected routes
// FIX: Changed type annotations to use express.Request, express.Response, and express.NextFunction to resolve type conflicts.
// @FIX: Use express.Request, express.Response, and express.NextFunction for proper type inference in middleware.
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized.' });
    
    const [userId] = token.split(':');
    const user = getUsers().find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'Invalid token: User not found.' });

    (req as any).userId = userId;
    next();
};

// --- ROUTES ---

// Signup
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/signup', async (req: express.Request, res: express.Response) => {
    const { name, email, password, username } = req.body;
    if (!name || !email || !password || !username) return res.status(400).json({ error: 'Missing required fields.' });

    if (!validateGmail(email)) {
        return res.status(400).json({ error: 'Please use a valid Gmail address without "." or "+" aliases.' });
    }

    const users = getUsers();
    if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'This username is already taken.' });
    
    const passwordHash = await hashPassword(password);
    const newUser = {
        id: `user_${Date.now()}`,
        name: sanitize(name), email, username: sanitize(username),
        passwordHash, role: 'user'
    };
    saveUsers([...users, newUser]);
    const token = createToken(newUser.id);
    res.status(201).json({ user: toPublicUser(newUser), token });
});

// Login
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/login', async (req: express.Request, res: express.Response) => {
    const { email, password } = req.body;
    const user = getUsers().find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    
    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = createToken(user.id);
    res.status(200).json({ user: toPublicUser(user), token });
});

// Get User Data (Watchlist & History)
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.get('/data', authMiddleware, (req: express.Request, res: express.Response) => {
    const watchlist = getWatchlists()[(req as any).userId] || [];
    const history = getHistories()[(req as any).userId] || [];
    res.status(200).json({ watchlist, history });
});

// Update Profile
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.put('/profile', authMiddleware, (req: express.Request, res: express.Response) => {
    const updates = req.body;
    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === (req as any).userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });

    if (updates.name) users[userIndex].name = sanitize(updates.name);
    if (updates.username) {
        if (users.some((u: any) => u.id !== (req as any).userId && u.username.toLowerCase() === updates.username.toLowerCase())) {
            return res.status(409).json({ error: 'Username is already taken.' });
        }
        users[userIndex].username = sanitize(updates.username);
    }
    if (updates.profilePic) users[userIndex].profilePic = updates.profilePic;

    saveUsers(users);
    const updatedUser = users[userIndex];
    const token = createToken(updatedUser.id); // Re-issue token in case session needs refresh
    res.status(200).json({ user: toPublicUser(updatedUser), token });
});

// Toggle Watchlist Item
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/watchlist', authMiddleware, (req: express.Request, res: express.Response) => {
    const { movieId } = req.body;
    const watchlists = getWatchlists();
    let userWatchlist = watchlists[(req as any).userId] || [];
    if (userWatchlist.includes(movieId)) {
        userWatchlist = userWatchlist.filter((id: string) => id !== movieId);
    } else {
        userWatchlist.push(movieId);
    }
    watchlists[(req as any).userId] = userWatchlist;
    saveWatchlists(watchlists);
    res.status(200).json({ watchlist: userWatchlist });
});

// Add to Viewing History
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/history', authMiddleware, (req: express.Request, res: express.Response) => {
    const { movieId } = req.body;
    const histories = getHistories();
    let userHistory = histories[(req as any).userId] || [];
    userHistory = userHistory.filter((item: any) => item.movieId !== movieId);
    userHistory.unshift({ movieId, viewedAt: new Date().toISOString() });
    if (userHistory.length > 50) userHistory = userHistory.slice(0, 50);
    histories[(req as any).userId] = userHistory;
    saveHistories(histories);
    res.status(200).json({ success: true });
});

export default router;