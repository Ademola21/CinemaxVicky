import { getSession } from './storageService';
import { Comment } from './types';

// Type for creating a new comment, only includes user-submittable fields.
export type NewCommentData = {
    comment: string;
    parentId?: string | null;
    rating?: number;
};

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};


export const getCommentsForMovie = async (movieId: string): Promise<{ comments: Comment[], upvotes: Record<string, string[]> }> => {
    const response = await fetch(`/api/comments?movieId=${movieId}`);
    return handleResponse(response);
};

export const addComment = async (movieId: string, commentData: NewCommentData): Promise<{ success: boolean; comment: Comment }> => {
    const session = getSession();
    if (!session) throw new Error('You must be logged in to comment.');

    const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, commentData, session }),
    });
    return handleResponse(response);
};

export const deleteComment = async (movieId: string, commentId: string): Promise<{ success: boolean }> => {
    const session = getSession();
    if (!session) throw new Error('You must be logged in to perform this action.');

    const response = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, commentId, session }),
    });
    return handleResponse(response);
};

export const toggleUpvote = async (commentId: string): Promise<{ success: boolean; upvotes: string[] }> => {
    const session = getSession();
    if (!session) throw new Error('You must be logged in to upvote.');

    const response = await fetch('/api/comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, session }),
    });
    return handleResponse(response);
};
