
import { UserState } from './types';
import fs from 'fs';
import path from 'path';

// In-memory store for user conversation states.
// In a production bot, this should be a persistent store like Redis or a database.
const userStates: { [userId: number]: UserState } = {};

export const setUserState = (userId: number, state: UserState) => {
    userStates[userId] = state;
};

export const getUserState = (userId: number): UserState | undefined => {
    return userStates[userId];
};

export const clearUserState = (userId: number) => {
    delete userStates[userId];
};

export const clearAllUserStates = () => {
    for (const key in userStates) {
        delete userStates[key];
    }
    console.log("Cleared all user states.");
};


/**
 * Performs an atomic write to a file to prevent data corruption.
 * It writes to a temporary file first, then renames it to the final destination.
 * @param filePath The final path of the file.
 * @param data The string data to write.
 */
export const atomicWrite = (filePath: string, data: string) => {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
        fs.writeFileSync(tempPath, data, 'utf-8');
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        console.error(`Atomic write failed for ${filePath}:`, error);
        // Clean up temp file if it exists
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
};
