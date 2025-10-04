import React, { MouseEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Movie } from '../services/types';
import { StarIcon, BookmarkIcon } from './icons/Icons';
import { useAuth } from '../contexts/AuthContext';
import * as storage from '../services/storageService';


interface MovieCardProps {
  movie: Movie;
  animationDelay?: string;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, animationDelay }) => {
  const { currentUser } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Effect to check initial watchlist status from the API
  useEffect(() => {
    let isMounted = true;
    const checkWatchlist = async () => {
      if (currentUser) {
        try {
          const data = await storage.getUserData();
          if (isMounted) {
            setInWatchlist(data.watchlist.includes(movie.id));
          }
        } catch (error) {
          console.error("Failed to check watchlist status", error);
        } finally {
            if (isMounted) setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    checkWatchlist();
    return () => { isMounted = false; };
  }, [currentUser, movie.id]);


  const handleWatchlistToggle = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to add movies to your watchlist.');
      return;
    }
    
    // Optimistic UI update
    const previousState = inWatchlist;
    setInWatchlist(!previousState);

    try {
      await storage.toggleWatchlist(movie.id);
    } catch (error) {
      console.error("Failed to toggle watchlist", error);
      // Revert on error
      setInWatchlist(previousState);
      alert('Could not update watchlist. Please try again.');
    }
  };

  const style = animationDelay ? { animationDelay } : {};
  return (
    <Link 
      to={`/movie/${movie.id}`} 
      className="group block bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-green-500/20 transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50 animate-fade-in"
      style={style}
    >
      <div className="relative">
        <div className="aspect-[3/4] w-full">
          <img 
            src={movie.poster} 
            alt={movie.title} 
            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity duration-300"
            loading="lazy"
          />
        </div>
        {currentUser && (
          <button
            onClick={handleWatchlistToggle}
            disabled={isLoading}
            className={`absolute top-2 left-2 p-1.5 rounded-full transition-colors duration-200 z-10 ${
              inWatchlist 
                ? 'bg-green-500 text-white' 
                : 'bg-black/60 backdrop-blur-sm text-gray-200 hover:bg-green-600 hover:text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>
        )}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
          <StarIcon className="w-3 h-3 text-yellow-400" />
          <span>{movie.rating.toFixed(1)}</span>
        </div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-100 group-hover:opacity-100 transition-opacity duration-300"></div>
          {movie.partNumber && movie.partNumber > 1 && (
            <span className="absolute bottom-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                Part {movie.partNumber}
            </span>
          )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-white truncate group-hover:text-green-400 transition-colors duration-300">{movie.title}</h3>
        <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
          <span>{movie.category}</span>
          <span>{new Date(movie.releaseDate).getFullYear()}</span>
        </div>
      </div>
    </Link>
  );
};

export default React.memo(MovieCard);