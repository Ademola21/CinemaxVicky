
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMovies } from '../contexts/MovieContext';
import * as storage from '../services/storageService';
import MovieCard from '../components/MovieCard';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { BookmarkIcon } from '../components/icons/Icons';
import { useNavigate, Link } from 'react-router-dom';

const WatchlistPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { movies, loading: moviesLoading, error: moviesError } = useMovies();
  const navigate = useNavigate();

  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!moviesLoading && !currentUser) {
      navigate('/login');
      return;
    }
    
    const fetchWatchlist = async () => {
        if (currentUser) {
            try {
                const data = await storage.getUserData();
                setWatchlistIds(data.watchlist);
            } catch (error) {
                console.error("Failed to fetch watchlist:", error);
            } finally {
                setDataLoading(false);
            }
        } else {
            setDataLoading(false);
        }
    };
    
    // Only fetch when the movie data is ready
    if (!moviesLoading) {
      fetchWatchlist();
    }
  }, [currentUser, moviesLoading, navigate]);

  const watchlistMovies = useMemo(() => {
    if (movies.length === 0) return [];
    // Filter movies and maintain the order they were added in (reverse for newest first)
    return [...watchlistIds].reverse().map(id => movies.find(movie => movie.id === id)).filter(Boolean) as (typeof movies);
  }, [watchlistIds, movies]);

  const isLoading = moviesLoading || dataLoading;

  if (isLoading) {
    return <div className="flex justify-center items-center h-full py-20"><LoadingSpinner text="Loading your watchlist..." /></div>;
  }

  if (moviesError) {
    return <div className="text-center py-20 text-red-400">Error: {moviesError}</div>;
  }
  
  return (
    <div>
      <BackButton />
      <section className="text-center py-8 animate-fade-in">
         <div className="inline-block p-4 bg-gray-800 rounded-full mb-4 border-2 border-gray-700">
          <BookmarkIcon className="w-12 h-12 text-green-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          My Watchlist
        </h1>
        <p className="text-gray-300 mt-2">Movies you've saved to watch later.</p>
      </section>

      <section className="mt-8">
        {watchlistMovies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {watchlistMovies.map((movie, index) => (
              <MovieCard key={movie.id} movie={movie} animationDelay={`${index * 75}ms`} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-700 rounded-lg">
            <h2 className="text-2xl font-bold">Your Watchlist is Empty</h2>
            <p className="mt-2">Add movies to your watchlist to see them here.</p>
             <Link to="/" className="mt-6 inline-block bg-green-600 text-white font-bold py-2 px-6 rounded-full hover:bg-green-500 transition-colors">
                Browse Movies
             </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default WatchlistPage;
