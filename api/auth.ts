/**
 * This module provides simple session validation for the serverless API function.
 * In a real-world scenario, this would involve more robust checks, such as
 * verifying a cryptographically signed JWT against a public key or checking
 * a session ID against a database/cache like Redis.
 * For this project's architecture, we validate the structure and expiration
 * of the session object passed from the frontend.
 */

interface Session {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        username: string;
        role: string;
    };
    expires: number;
}

/**
 * Validates the structure and expiration of a session object.
 * @param session The session object received from the frontend.
 * @returns True if the session is valid, otherwise false.
 */
export function validateSession(session: any): session is Session {
    if (!session || typeof session !== 'object') {
        console.warn('Auth failed: Session is missing or not an object.');
        return false;
    }
    if (!session.user || typeof session.user !== 'object' || typeof session.user.id !== 'string' || !session.user.id) {
        console.warn('Auth failed: Invalid or missing user.id in session.');
        return false;
    }
    if (typeof session.token !== 'string' || !session.token) {
        console.warn('Auth failed: Invalid or missing token in session.');
        return false;
    }
    if (typeof session.expires !== 'number') {
        console.warn('Auth failed: Invalid or missing expiration in session.');
        return false;
    }
    if (session.expires <= Date.now()) {
        console.warn(`Auth failed: Expired session for user ${session.user.id}.`);
        return false;
    }
    return true;
}
