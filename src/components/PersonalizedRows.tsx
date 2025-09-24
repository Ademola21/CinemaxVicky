import React, { useState, useEffect, useMemo } from 'react';
import { Movie } from '../services/types';
import * as storage from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { useMovies } from '../contexts/MovieContext';
import { getAiPersonalizedRecommendations } from '../services/aiService';
// FIX: Corrected the import for MovieCarousel. It should be imported from its own file within the components directory.
import MovieCarousel from './MovieCarousel';
import LoadingSpinner from './LoadingSpinner';

const PersonalizedRows: React.FC = () => {
  const { currentUser } = useAuth();
  const { movies } = useMovies();
  const [viewingHistory, setViewingHistory] = useState<{ movieId: string, viewedAt: string }[]>([]);
  const [aiPicks, setAiPicks] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (currentUser && movies.length > 0) {
        setIsLoading(true);
        try {
          const data = await storage.getUserData();
          setViewingHistory(data.history);

          if (data.history.length > 0) {
            const recs = await getAiPersonalizedRecommendations(data.history, movies);
            if (recs) {
              const recommendedMovies = recs
                .map(rec => movies.find(m => m.id === rec.movieId))
                .filter((m): m is Movie => !!m);
              setAiPicks(recommendedMovies);
            }
          }
        } catch (error) {
          console.error("Failed to fetch personalized data:", error);
          setAiPicks([]);
          setViewingHistory([]);
        } finally {
          setIsLoading(false);
        }
      } else {
          setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser, movies]);


  const lastWatchedMovie = useMemo(() => {
    if (viewingHistory.length === 0) return null;
    return movies.find(m => m.id === viewingHistory[0].movieId);
  }, [viewingHistory, movies]);
  
  const becauseYouWatched = useMemo(() => {
    if (!lastWatchedMovie) return [];
    return movies
      .filter(m => m.id !== lastWatchedMovie.id && m.category === lastWatchedMovie.category)
      .slice(0, 10);
  }, [lastWatchedMovie, movies]);

  if (isLoading) {
      return <div className="flex justify-center my-8"><LoadingSpinner text="Curating your top picks..." /></div>
  }
  
  if (!currentUser || viewingHistory.length === 0) {
    return null;
  }

  return (
    <>
      {aiPicks.length > 0 && <MovieCarousel title="Top Picks For You" movies={aiPicks} />}
      
      {becauseYouWatched.length > 0 && lastWatchedMovie && (
        <MovieCarousel 
          title={`Because you watched ${lastWatchedMovie.title}`} 
          movies={becauseYouWatched} 
        />
      )}
    </>
  );
};

export default PersonalizedRows;