import React, { useState, useEffect, useRef } from 'react';
// FIX: react-router-dom v5 uses useHistory instead of useNavigate.
import { useNavigate } from 'react-router-dom';
import { Movie } from '../services/types';
import { SearchIcon } from './icons/Icons';
import { findMovieByDescription } from '../services/aiService';
import LoadingSpinner from './LoadingSpinner';
import { useMovies } from '../contexts/MovieContext';

interface SearchBarProps {
  onSearch: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const navigate = useNavigate();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const { movies } = useMovies();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length > 2 && movies.length > 0) {
      setIsAiSearching(false); // Reset AI search state on new query
      const lowercasedQuery = query.toLowerCase();
      const filteredMovies = movies.filter(movie =>
        movie.title.toLowerCase().includes(lowercasedQuery) ||
        movie.genre.toLowerCase().includes(lowercasedQuery) ||
        movie.stars.some(star => star.toLowerCase().includes(lowercasedQuery))
      ).slice(0, 5);
      setResults(filteredMovies);

      // If no initial results, trigger AI search after a short delay
      if (filteredMovies.length === 0 && query.trim().split(' ').length >= 3) {
        searchTimeoutRef.current = window.setTimeout(() => {
          setIsAiSearching(true);
          findMovieByDescription(query, movies).then(foundMovie => {
              if (foundMovie) {
                  setResults([foundMovie]);
              }
          }).finally(() => {
              setIsAiSearching(false);
          });
        }, 800);
      }

    } else {
      setResults([]);
      setIsAiSearching(false);
    }
     return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, movies]);

  const handleSelectMovie = (movieId: string) => {
    setQuery('');
    setResults([]);
    setIsFocused(false);
    onSearch();
    navigate(`/movie/${movieId}`);
  };

  return (
    <div className="relative w-full" ref={searchContainerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search movies or describe a scene..."
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <SearchIcon />
        </div>
      </div>
      {isFocused && (query.length > 2) && (
        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {isAiSearching ? (
             <div className="p-4"><LoadingSpinner text="AI is searching..." /></div>
          ) : results.length > 0 ? (
            <ul>
              {results.map(movie => (
                <li key={movie.id}>
                  <button
                    onClick={() => handleSelectMovie(movie.id)}
                    className="w-full text-left flex items-center p-3 hover:bg-gray-700 transition-colors"
                  >
                    <img src={movie.poster} alt={movie.title} className="w-10 h-14 object-cover rounded mr-3" />
                    <div>
                      <p className="font-semibold text-white">{movie.title}</p>
                      <p className="text-xs text-gray-400">{movie.category} &bull; {new Date(movie.releaseDate).getFullYear()}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-gray-400">
                No results found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;