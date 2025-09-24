import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import { StarIcon, UserIcon, ReplyIcon, ChevronDownIcon, ChevronUpIcon, BotIcon, SparklesIcon, ThumbsUpIcon, BookmarkIcon, FacebookIcon, XSocialIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, WhatsAppIcon, TelegramIcon } from '../components/icons/Icons';
import LoadingSpinner from '../components/LoadingSpinner';
import { Comment, Movie, User } from '../services/types';
import { getAiRecommendations } from '../services/aiService';
import BackButton from '../components/BackButton';
import { useMovies } from '../contexts/MovieContext';
import { useAuth } from '../contexts/AuthContext';
import * as storage from '../services/storageService';
import * as analytics from '../services/analyticsService';
import * as commentService from '../services/commentService';


// --- SOCIAL SHARE COMPONENT ---
const SocialShare: React.FC<{ movie: Movie }> = ({ movie }) => {
    const url = window.location.href;
    const text = `Check out "${movie.title}" on Yoruba Cinemax!`;
    
    const platforms = {
        twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    };

    return (
        <div className="flex items-center gap-3 mt-6">
            <span className="text-sm font-semibold text-gray-300">Share:</span>
            <a href={platforms.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded-full hover:bg-black transition-colors" aria-label="Share on X (Twitter)">
                <XSocialIcon className="w-4 h-4" />
            </a>
            <a href={platforms.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded-full hover:bg-blue-600 transition-colors" aria-label="Share on Facebook">
                <FacebookIcon className="w-4 h-4" />
            </a>
             <a href={platforms.whatsapp} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded-full hover:bg-green-500 transition-colors" aria-label="Share on WhatsApp">
                <WhatsAppIcon className="w-4 h-4" />
            </a>
            <a href={platforms.telegram} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded-full hover:bg-blue-500 transition-colors" aria-label="Share on Telegram">
                <TelegramIcon className="w-4 h-4" />
            </a>
        </div>
    );
};


// --- COMMENT FORM COMPONENT ---
const CommentForm: React.FC<{
  movieId: string;
  parentId?: string | null;
  onCommentAdded: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}> = ({ movieId, parentId = null, onCommentAdded, onCancel, submitLabel = "Submit" }) => {
    const { currentUser } = useAuth();
    const [commentText, setCommentText] = useState('');
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser || isSubmitting) return;
        
        setIsSubmitting(true);
        setError('');
        try {
            await commentService.addComment(movieId, {
                comment: commentText.trim(),
                parentId,
                rating: parentId === null && rating > 0 ? rating : undefined,
            });
            onCommentAdded();
            setCommentText('');
            setRating(0);
            if (onCancel) onCancel();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to post comment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={parentId ? `Replying as ${currentUser?.name}...` : `Commenting as ${currentUser?.name}...`}
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                required
            />
            {parentId === null && (
                 <div className="flex items-center gap-2">
                    <span className="text-gray-400">Your Rating:</span>
                    <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                type="button"
                                key={star}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                className="text-2xl"
                                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                                <StarIcon
                                    className={`w-6 h-6 transition-colors ${
                                        (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-600'
                                    }`}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">
                        Cancel
                    </button>
                )}
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500 transition-colors disabled:opacity-50" disabled={!commentText.trim() || isSubmitting}>
                    {isSubmitting ? 'Submitting...' : submitLabel}
                </button>
            </div>
        </form>
    );
};

// --- COMMENT ITEM COMPONENT ---
const CommentItem: React.FC<{
  movieId: string;
  comment: Comment;
  upvotes: string[]; // User IDs who upvoted
  onCommentChange: () => void;
}> = ({ movieId, comment, upvotes, onCommentChange }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [showReplies, setShowReplies] = useState(true);
    const { currentUser, isAdmin } = useAuth();
    
    // This is now just for display purposes; the backend holds the truth.
    const [optimisticUpvotes, setOptimisticUpvotes] = useState(upvotes);

    // FIX: User data now comes from the session, not a separate storage call.
    // This part of the logic is simplified as the backend handles user data.
    const commentUser = { name: comment.reviewer, id: comment.userId, role: comment.reviewer === 'Yoruba Cinemax' ? 'admin' : 'user' };
    const isOwner = commentUser?.role === 'admin';

    const handleUpvote = async () => {
        if (!currentUser) {
            alert("Please log in to upvote comments.");
            return;
        }
        const hasUpvoted = optimisticUpvotes.includes(currentUser.id);
        // Optimistic update
        setOptimisticUpvotes(prev => hasUpvoted ? prev.filter(id => id !== currentUser.id) : [...prev, currentUser.id]);
        try {
            await commentService.toggleUpvote(comment.id);
            onCommentChange(); // Re-fetch from server to ensure sync
        } catch (error) {
            console.error(error);
            setOptimisticUpvotes(upvotes); // Revert on error
            alert("Failed to save upvote. Please try again.");
        }
    };
    
    const handleDeleteComment = async () => {
        if (window.confirm("Are you sure you want to delete this comment and all its replies?")) {
            try {
                await commentService.deleteComment(movieId, comment.id);
                onCommentChange(); // Refresh the comment list
            } catch (error) {
                alert("Failed to delete comment.");
            }
        }
    };

    const UserAvatar: React.FC<{ user: { name: string, id: string } }> = ({ user }) => {
        if (comment.isAI) {
            return <div className="w-10 h-10 flex-shrink-0 bg-green-500 rounded-full flex items-center justify-center"><BotIcon className="w-6 h-6"/></div>;
        }
        // In a real app with profile pics, this would fetch the user's pic
        return <div className="w-10 h-10 flex-shrink-0 bg-gray-700 rounded-full flex items-center justify-center"><UserIcon className="w-6 h-6 text-gray-400" /></div>;
    };


    return (
        <div className={`ml-${comment.parentId ? '6' : '0'} mt-4`}>
            <div className="flex items-start space-x-3">
                 <div className="flex-shrink-0">
                    <UserAvatar user={commentUser} />
                </div>
                <div className="flex-1">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                            <p className="font-bold text-white flex items-center gap-2">
                                {comment.reviewer}
                                {isOwner && <span className="text-xs font-bold text-gray-900 bg-yellow-400 px-2 py-0.5 rounded-full shadow">Admin</span>}
                            </p>
                            <span className="text-xs text-gray-500">{new Date(comment.date).toLocaleDateString()}</span>
                        </div>
                        {comment.rating && (
                            <div className="flex items-center my-1">
                                {[...Array(5)].map((_, i) => (
                                    <StarIcon key={i} className={`w-4 h-4 ${i < comment.rating! ? 'text-yellow-400' : 'text-gray-600'}`} />
                                ))}
                            </div>
                        )}
                        <p className={`text-gray-300 mt-1 whitespace-pre-wrap ${comment.isAI ? 'italic' : ''}`}>{comment.comment}</p>
                    </div>
                    <div className="mt-1 flex items-center space-x-4">
                        {currentUser && (
                            <button onClick={() => setShowReplyForm(!showReplyForm)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-400 transition-colors">
                                <ReplyIcon className="w-3 h-3"/> Reply
                            </button>
                        )}
                        <button onClick={handleUpvote} className={`flex items-center gap-1 text-xs transition-colors ${currentUser && optimisticUpvotes.includes(currentUser.id) ? 'text-green-400 font-bold' : 'text-gray-400 hover:text-green-400'}`}>
                            <ThumbsUpIcon className="w-3 h-3"/> {optimisticUpvotes.length}
                        </button>
                        {isAdmin && (
                             <button onClick={handleDeleteComment} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors">
                                <XIcon className="w-3 h-3"/> Delete
                             </button>
                        )}
                        {comment.replies && comment.replies.length > 0 && (
                             <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
                                {showReplies ? <ChevronUpIcon className="w-3 h-3"/> : <ChevronDownIcon className="w-3 h-3"/>}
                                {comment.replies.length} {comment.replies.length > 1 ? 'replies' : 'reply'}
                             </button>
                        )}
                    </div>
                </div>
            </div>
            {showReplyForm && (
                <div className="ml-12 mt-2">
                    <CommentForm
                        movieId={movieId}
                        parentId={comment.id}
                        onCommentAdded={() => {
                            onCommentChange();
                            setShowReplyForm(false);
                        }}
                        onCancel={() => setShowReplyForm(false)}
                        submitLabel="Post Reply"
                    />
                </div>
            )}
            {showReplies && comment.replies && comment.replies.length > 0 && (
                <div className="border-l-2 border-gray-700 ml-5 pl-1">
                    {comment.replies.map(reply => (
                        <CommentItem key={reply.id} movieId={movieId} comment={reply} upvotes={upvotes[reply.id] || []} onCommentChange={onCommentChange} />
                    ))}
                </div>
            )}
        </div>
    );
};


// --- COMMENTS SECTION COMPONENT ---
const CommentsSection: React.FC<{ movie: Movie }> = ({ movie }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [upvotes, setUpvotes] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const { currentUser } = useAuth();
    const location = useLocation();

    const fetchComments = useCallback(async () => {
        if (!movie.id) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await commentService.getCommentsForMovie(movie.id);
            setComments(data.comments);
            setUpvotes(data.upvotes);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load comments.');
        } finally {
            setIsLoading(false);
        }
    }, [movie.id]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);


    return (
        <section className="mt-12">
            <h2 className="text-3xl font-bold text-white mb-6">Reviews & Comments</h2>
            <div className="mb-8">
                {currentUser ? (
                    <CommentForm movieId={movie.id} onCommentAdded={fetchComments} />
                ) : (
                    <div className="text-center p-6 bg-gray-800 border border-gray-700 rounded-lg">
                        <p className="text-gray-300">You must be logged in to leave a comment.</p>
                        <div className="mt-4">
                            <Link 
                                to="/login"
                                state={{ from: location.pathname }}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500 transition-colors">
                                Login or Sign Up
                            </Link>
                        </div>
                    </div>
                )}
            </div>
            <div>
                {isLoading && <LoadingSpinner text="Loading comments..." />}
                {error && <p className="text-center text-red-400">{error}</p>}
                {!isLoading && !error && comments.length === 0 && (
                    <p className="text-gray-500 text-center py-4">Be the first to leave a comment!</p>
                )}
                {!isLoading && !error && comments.length > 0 && (
                    comments.map(comment => (
                        <CommentItem key={comment.id} movieId={movie.id} comment={comment} upvotes={upvotes[comment.id] || []} onCommentChange={fetchComments} />
                    ))
                )}
            </div>
        </section>
    );
};

// --- AI RECOMMENDATIONS COMPONENT ---
const AiRecommendations: React.FC<{
  recs: { movie: Movie, reason: string }[];
}> = ({ recs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <section className="mt-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <SparklesIcon className="text-green-400"/>
            AI Recommendations
        </h2>
        <div className="space-x-2">
            <button onClick={() => scroll('left')} className="p-2 bg-gray-800/50 rounded-full hover:bg-green-600 transition-colors" aria-label="Scroll left"><ChevronLeftIcon/></button>
            <button onClick={() => scroll('right')} className="p-2 bg-gray-800/50 rounded-full hover:bg-green-600 transition-colors" aria-label="Scroll right"><ChevronRightIcon/></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex space-x-4 md:space-x-6 overflow-x-auto pb-4 no-scrollbar">
        {recs.map(({ movie: recMovie, reason }, index) => (
          <div key={recMovie.id} className="flex-shrink-0 w-40 sm:w-48 md:w-56 animate-fade-in" style={{ animationDelay: `${index * 75}ms` }}>
            <div className="bg-gray-800/50 p-2 rounded-lg flex flex-col h-full border border-gray-700/50">
              <MovieCard movie={recMovie} />
              <p className="text-xs text-gray-400 mt-2 p-1 italic flex-grow">"{reason}"</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};


// --- MAIN MOVIE DETAILS PAGE COMPONENT ---
const MovieDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { movies, loading, error } = useMovies();
  const { currentUser } = useAuth();
  const [aiRecs, setAiRecs] = useState<{ movie: Movie, reason: string }[] | null>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(true);

  const movie = useMemo(() => movies.find((m) => m.id === id), [id, movies]);

  const movieParts = useMemo(() => {
    if (!movie?.seriesTitle) return [];
    return movies
        .filter(m => m.seriesTitle === movie.seriesTitle)
        .sort((a, b) => (a.partNumber || 1) - (b.partNumber || 1));
  }, [movie, movies]);

  useEffect(() => {
    const checkWatchlist = async () => {
        if (currentUser && movie) {
            setWatchlistLoading(true);
            const data = await storage.getUserData();
            setInWatchlist(data.watchlist.includes(movie.id));
            setWatchlistLoading(false);
        } else {
            setWatchlistLoading(false);
        }
    };
    checkWatchlist();
  }, [currentUser, movie]);
  
  const handleWatchlistToggle = async () => {
    if (currentUser && movie && !watchlistLoading) {
        setWatchlistLoading(true);
        try {
            await storage.toggleWatchlist(movie.id);
            setInWatchlist(!inWatchlist);
        } catch (error) {
            alert('Failed to update watchlist. Please try again.');
        } finally {
            setWatchlistLoading(false);
        }
    } else if (!currentUser) {
        alert('Please log in to manage your watchlist.');
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (currentUser && id) {
        storage.addToViewingHistory(id);
    }
    if (movie) {
        analytics.logMovieClick(movie.id, movie.title);
    }
  }, [id, currentUser, movie]);

  useEffect(() => {
    const fetchRecommendations = async () => {
        if (movie && movies.length > 1) {
            setIsLoadingRecs(true);
            try {
                const recsData = await getAiRecommendations(movie, movies);
                if (recsData) {
                    const recommendedMovies = recsData
                        .map(rec => ({
                            movie: movies.find(m => m.id === rec.movieId),
                            reason: rec.reason
                        }))
                        .filter(item => item.movie) as { movie: Movie, reason: string }[];
                    setAiRecs(recommendedMovies);
                }
            } catch (error) {
                console.error("Failed to fetch AI recommendations:", error);
                setAiRecs(null);
            } finally {
                setIsLoadingRecs(false);
            }
        } else {
            setIsLoadingRecs(false);
        }
    };
    fetchRecommendations();
  }, [movie, movies]);

  if (loading) {
    return <div className="flex justify-center items-center h-full py-20"><LoadingSpinner text="Loading movie details..." /></div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">Error: {error}</div>;
  }

  if (!movie) {
    return (
        <div className="text-center py-20">
            <BackButton />
            <h1 className="text-4xl font-bold text-white">404 - Movie Not Found</h1>
            <p className="text-gray-400 mt-4">We couldn't find the movie you were looking for.</p>
        </div>
    );
  }

  const relatedMovies = movies.filter(m => m.category === movie.category && m.id !== movie.id).slice(0, 5);
  
  const DownloadButton = () => {
    const commonClasses = "inline-block w-full text-center sm:w-auto bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:shadow-green-500/40 transition-all duration-300 transform hover:scale-105";
    const isYouTubeLink = movie.downloadLink && (movie.downloadLink.includes('youtube.com') || movie.downloadLink.includes('youtu.be'));

    if (movie.status === 'coming-soon') {
      return (
        <div className="inline-block w-full text-center sm:w-auto bg-gray-700 text-white font-bold py-3 px-10 rounded-full text-lg">
          Coming Soon
        </div>
      );
    }
    
    if (isYouTubeLink) {
        return (
            <Link
                to={`/youtube-downloader?url=${encodeURIComponent(movie.downloadLink)}`}
                className={commonClasses}
            >
                Download Movie
            </Link>
        );
    }

    return (
        <a
            href={movie.downloadLink}
            target="_blank"
            rel="noopener noreferrer"
            className={commonClasses}
        >
            Download Movie
        </a>
    );
  };


  return (
    <div>
        <BackButton />
        <section className="flex flex-col md:flex-row gap-8 md:gap-12 animate-fade-in">
            <div className="md:w-1/3 flex-shrink-0">
                <img src={movie.poster} alt={movie.title} className="w-full h-auto object-cover rounded-lg shadow-2xl" />
            </div>
            <div className="md:w-2/3">
                <h1 className="text-4xl md:text-5xl font-black text-white">{movie.title}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 my-4 text-gray-300">
                    <div className="flex items-center text-yellow-400">
                        <StarIcon className="w-5 h-5 mr-1" />
                        <span className="font-bold text-lg">{movie.rating.toFixed(1)}</span>
                    </div>
                    <span>&bull;</span>
                    <span>{new Date(movie.releaseDate).getFullYear()}</span>
                    <span>&bull;</span>
                    <span>{movie.runtime}</span>
                    <span>&bull;</span>
                    <span className="px-2 py-1 bg-gray-700 text-xs rounded">{movie.category}</span>
                </div>
                <p className="text-gray-300 leading-relaxed mb-6">{movie.description}</p>
                <div className="space-y-2 text-sm">
                    <p><strong className="text-gray-200">Starring:</strong> {movie.stars.map((star, index) => (
                        <React.Fragment key={star}>
                            <Link to={`/actor/${encodeURIComponent(star)}`} className="hover:text-green-400 hover:underline">{star}</Link>
                            {index < movie.stars.length - 1 && ', '}
                        </React.Fragment>
                    ))}</p>
                    <p><strong className="text-gray-200">Genre:</strong> {movie.genre}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-8">
                    <DownloadButton />
                    {currentUser && (
                         <button onClick={handleWatchlistToggle} disabled={watchlistLoading} className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto font-bold py-3 px-6 rounded-full text-lg shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait ${inWatchlist ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-900'}`}>
                            <BookmarkIcon className="w-5 h-5"/>
                            {watchlistLoading ? 'Updating...' : (inWatchlist ? 'On Watchlist' : 'Add to Watchlist')}
                        </button>
                    )}
                </div>
                <SocialShare movie={movie} />
            </div>
        </section>

        {movieParts.length > 1 && (
            <section className="mt-8 pt-8 border-t border-gray-800">
                <h3 className="text-2xl font-bold text-white mb-4">{movie.seriesTitle} Series</h3>
                <div className="flex flex-wrap items-center gap-3">
                    {movieParts.map(part => {
                        const isYouTubeLink = part.downloadLink && (part.downloadLink.includes('youtube.com') || part.downloadLink.includes('youtu.be'));
                        const isCurrent = part.id === movie.id;

                        if (isCurrent) {
                            return (
                                <span key={part.id} className="bg-gray-700 text-white font-bold py-2 px-5 rounded-full cursor-not-allowed">
                                    Part {part.partNumber} (Viewing)
                                </span>
                            );
                        }

                        if (isYouTubeLink) {
                            return (
                                <Link
                                    key={part.id}
                                    to={`/youtube-downloader?url=${encodeURIComponent(part.downloadLink)}`}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-5 rounded-full transition-colors"
                                >
                                    Part {part.partNumber}
                                </Link>
                            );
                        }
                        
                        return (
                            <span key={part.id} className="bg-gray-600 text-gray-400 font-bold py-2 px-5 rounded-full cursor-not-allowed" title="This part does not have a direct video link.">
                                Part {part.partNumber}
                            </span>
                        );
                    })}
                </div>
            </section>
        )}

        {movie.trailerId && (
            <section className="mt-12">
                <h2 className="text-3xl font-bold text-white mb-4">Watch Trailer</h2>
                <div className="relative overflow-hidden pt-[56.25%] rounded-lg border-2 border-gray-800">
                    <iframe 
                        src={`https://www.youtube.com/embed/${movie.trailerId}`} 
                        title={`${movie.title} Trailer`}
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                        className="absolute top-0 left-0 w-full h-full"
                    ></iframe>
                </div>
            </section>
        )}
        
        {isLoadingRecs ? (
            <div className="mt-12"><LoadingSpinner text="Getting AI Recommendations..." /></div>
        ) : aiRecs && aiRecs.length > 0 && (
            <AiRecommendations recs={aiRecs} />
        )}

        <CommentsSection movie={movie} />

        {relatedMovies.length > 0 && (
            <section className="mt-12">
                <h2 className="text-3xl font-bold text-white mb-4">Related Movies</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                    {relatedMovies.map((relatedMovie, index) => (
                        <MovieCard key={relatedMovie.id} movie={relatedMovie} animationDelay={`${index * 75}ms`} />
                    ))}
                </div>
            </section>
        )}
    </div>
  );
};

export default MovieDetailsPage;