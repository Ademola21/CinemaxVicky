import fs from 'fs';

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

/**
 * Validates a real Gmail address, rejecting "dot" and "plus" aliases.
 * @param email The email string to validate.
 * @returns True if the email is a valid, non-alias Gmail address.
 */
export const validateGmail = (email: string): boolean => {
    if (!email.toLowerCase().endsWith('@gmail.com')) {
        return false; // Must be a gmail.com address
    }
    const username = email.split('@')[0];
    if (username.includes('+')) {
        return false; // No plus aliases
    }
    if (username.length > 6 && username.includes('.')) {
        return false; // No dot aliases (heuristic, as gmail ignores dots)
    }
    return true;
};
