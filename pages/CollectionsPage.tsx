import React, { useState, useEffect } from 'react';
import { useMovies } from '../contexts/MovieContext';
import MovieCard from '../components/MovieCard';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { Movie, Collection } from '../services/types';

const CollectionsPage: React.FC = () => {
  const { movies, loading: moviesLoading, error: moviesError } = useMovies();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/collections');
        if (!response.ok) {
          throw new Error('Failed to fetch collections.');
        }
        const data = await response.json();
        setCollections(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  if (loading || moviesLoading) {
    return <div className="flex justify-center items-center h-full py-20"><LoadingSpinner text="Loading collections..." /></div>;
  }

  if (error || moviesError) {
    return <div className="text-center py-20 text-red-400">Error: {error || moviesError}</div>;
  }

  return (
    <div>
      <BackButton />
      <section className="text-center py-8 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          Themed Collections
        </h1>
        <p className="text-gray-300 mt-2">Hand-picked selections of the best Yoruba movies.</p>
      </section>

      <div className="mt-8 space-y-12">
        {collections.map(collection => {
            const collectionMovies = collection.movieIds
                .map(id => movies.find(m => m.id === id))
                .filter((m): m is Movie => !!m);

            if (collectionMovies.length === 0) return null;

            return (
                <div key={collection.id} className="animate-fade-in">
                    <div className="mb-4 pl-2">
                        <h2 className="text-3xl font-bold text-white">{collection.title}</h2>
                        <p className="text-gray-400 mt-1">{collection.description}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {collectionMovies.map((movie, index) => (
                            <MovieCard key={movie.id} movie={movie} animationDelay={`${index * 50}ms`} />
                        ))}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default CollectionsPage;