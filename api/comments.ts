import express from 'express';
const router = express.Router();
import fs from 'fs';
import path from 'path';
import { atomicWrite } from './utils';

// --- DB HELPERS & CONFIG ---
const COMMENTS_PATH = path.resolve(__dirname, '../data/comments.json');
const USERS_PATH = path.resolve(__dirname, '../data/users.json');

const readJsonFile = (filePath: string, defaultValue: any) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { return defaultValue; }
};
const writeCommentsDb = (data: any) => atomicWrite(COMMENTS_PATH, JSON.stringify(data, null, 2));

const readCommentsDb = () => readJsonFile(COMMENTS_PATH, { comments: {}, upvotes: {} });
const getUsers = () => readJsonFile(USERS_PATH, []);
const sanitize = (str: string) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const validateSession = (session: any) => {
    if (!session || typeof session !== 'object') {
        console.warn('Comments Auth failed: Session is missing or not an object.');
        return false;
    }
    if (!session.user || typeof session.user !== 'object' || typeof session.user.id !== 'string' || !session.user.id) {
        console.warn('Comments Auth failed: Invalid or missing user.id in session.');
        return false;
    }
    if (typeof session.token !== 'string' || !session.token) {
        console.warn('Comments Auth failed: Invalid or missing token in session.');
        return false;
    }
    if (typeof session.expires !== 'number') {
        console.warn('Comments Auth failed: Invalid or missing expiration in session.');
        return false;
    }
    if (session.expires <= Date.now()) {
        console.warn(`Comments Auth failed: Expired session for user ${session.user.id}.`);
        return false;
    }
    return true;
};

// --- ROUTES ---

// GET /api/comments?movieId=...
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.get('/', (req: express.Request, res: express.Response) => {
    const { movieId } = req.query;
    if (!movieId) return res.status(400).json({ error: 'Movie ID is required' });

    const db = readCommentsDb();
    const movieComments = db.comments[movieId as string] || [];

    const commentMap = new Map();
    movieComments.forEach((c: any) => { c.replies = []; commentMap.set(c.id, c); });

    const rootComments: any[] = [];
    movieComments.forEach((c: any) => {
        if (c.parentId && commentMap.has(c.parentId)) {
            commentMap.get(c.parentId).replies.push(c);
        } else {
            rootComments.push(c);
        }
    });

    const upvotesForMovie = Object.fromEntries(
        Object.entries(db.upvotes).filter(([commentId]) => commentMap.has(commentId))
    );

    res.status(200).json({ comments: rootComments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), upvotes: upvotesForMovie });
});

// POST /api/comments (add new comment)
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.post('/', (req: express.Request, res: express.Response) => {
    const { movieId, commentData, session } = req.body;
    if (!validateSession(session)) return res.status(401).json({ error: 'Unauthorized' });

    const user = getUsers().find((u: any) => u.id === session.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const db = readCommentsDb();
    const newComment = {
        id: `comment_${Date.now()}`,
        parentId: commentData.parentId || null,
        reviewer: user.name,
        userId: user.id,
        comment: sanitize(commentData.comment),
        date: new Date().toISOString(),
        rating: commentData.parentId ? undefined : commentData.rating,
    };

    if (!db.comments[movieId]) db.comments[movieId] = [];
    db.comments[movieId].push(newComment);
    writeCommentsDb(db);

    res.status(201).json({ success: true, comment: newComment });
});

// PUT /api/comments (toggle upvote)
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.put('/', (req: express.Request, res: express.Response) => {
    const { commentId, session } = req.body;
    if (!validateSession(session)) return res.status(401).json({ error: 'Unauthorized' });

    const db = readCommentsDb();
    let upvoteUserIds = db.upvotes[commentId] || [];
    if (upvoteUserIds.includes(session.user.id)) {
        upvoteUserIds = upvoteUserIds.filter((id: string) => id !== session.user.id);
    } else {
        upvoteUserIds.push(session.user.id);
    }
    db.upvotes[commentId] = upvoteUserIds;
    writeCommentsDb(db);

    res.status(200).json({ success: true, upvotes: upvoteUserIds });
});

// DELETE /api/comments
// FIX: Changed type annotations to use express.Request and express.Response to resolve type conflicts.
// @FIX: Use express.Request and express.Response for proper type inference on request handlers.
router.delete('/', (req: express.Request, res: express.Response) => {
    const { movieId, commentId, session } = req.body;
    if (!validateSession(session)) return res.status(401).json({ error: 'Unauthorized' });

    const user = getUsers().find((u: any) => u.id === session.user.id);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const db = readCommentsDb();
    let movieComments = db.comments[movieId] || [];

    const commentsToDelete = new Set([commentId]);
    let changed = true;
    while(changed) {
        changed = false;
        const currentSize = commentsToDelete.size;
        movieComments.forEach((c: any) => { if(c.parentId && commentsToDelete.has(c.parentId)) commentsToDelete.add(c.id); });
        if(commentsToDelete.size > currentSize) changed = true;
    }

    db.comments[movieId] = movieComments.filter((c: any) => !commentsToDelete.has(c.id));
    commentsToDelete.forEach(id => delete db.upvotes[id]);
    writeCommentsDb(db);

    res.status(200).json({ success: true });
});

export default router;