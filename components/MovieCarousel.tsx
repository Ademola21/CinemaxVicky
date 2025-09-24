
import React, { useRef } from 'react';
import MovieCard from './MovieCard';
import { Movie } from '../services/types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';

interface MovieCarouselProps {
    title: string;
    movies: Movie[];
}

const MovieCarousel: React.FC<MovieCarouselProps> = ({ title, movies }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };
  
  if (!movies || movies.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        <div className="space-x-2">
          <button onClick={() => scroll('left')} className="p-2 bg-gray-800/50 rounded-full hover:bg-green-600 transition-colors" aria-label="Scroll left"><ChevronLeftIcon/></button>
          <button onClick={() => scroll('right')} className="p-2 bg-gray-800/50 rounded-full hover:bg-green-600 transition-colors" aria-label="Scroll right"><ChevronRightIcon/></button>
        </div>
      </div>
      <div ref={scrollRef} className="flex space-x-4 md:space-x-6 overflow-x-auto pb-4 no-scrollbar">
        {movies.map((movie, index) => (
          <div key={movie.id} className="flex-shrink-0 w-40 sm:w-48 md:w-56">
            <MovieCard movie={movie} animationDelay={`${index * 75}ms`} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default MovieCarousel;