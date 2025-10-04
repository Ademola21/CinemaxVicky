import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMovies } from '../contexts/MovieContext';
import MovieCard from '../components/MovieCard';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserCircleIcon } from '../components/icons/Icons';

interface Actor {
    name: string;
    bio: string;
    imageUrl: string;
}

const ActorPage: React.FC = () => {
    const { name } = useParams<{ name: string }>();
    const { movies, loading: moviesLoading, error: moviesError } = useMovies();
    const [actorDetails, setActorDetails] = useState<Actor | null>(null);
    const [loading, setLoading] = useState(true);
    
    const actorName = name ? decodeURIComponent(name) : 'Actor';

    useEffect(() => {
        const fetchActorDetails = async () => {
            try {
                const response = await fetch('/api/actors');
                if (!response.ok) throw new Error('Failed to fetch actors.');
                const actors: Actor[] = await response.json();
                const foundActor = actors.find(a => a.name.toLowerCase() === actorName.toLowerCase());
                setActorDetails(foundActor || null);
            } catch (err) {
                console.error("Error fetching actor details:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchActorDetails();
    }, [actorName]);

    const actorMovies = movies.filter(movie =>
        movie.stars.some(star => star.toLowerCase() === actorName.toLowerCase())
    );

    if (moviesLoading || loading) {
        return <div className="flex justify-center items-center h-full py-20"><LoadingSpinner text={`Loading profile for ${actorName}...`} /></div>;
    }

    if (moviesError) {
        return <div className="text-center py-20 text-red-400">Error: {moviesError}</div>;
    }

    return (
        <div>
            <BackButton />
            <section className="py-8 animate-fade-in flex flex-col sm:flex-row items-center text-center sm:text-left gap-6">
                <div className="flex-shrink-0">
                    <div className="w-40 h-40 bg-gray-800 rounded-full border-4 border-gray-700 flex items-center justify-center overflow-hidden">
                        {actorDetails?.imageUrl ? (
                             <img src={actorDetails.imageUrl} alt={actorName} className="w-full h-full object-cover" />
                        ) : (
                             <UserCircleIcon className="w-24 h-24 text-green-400" />
                        )}
                    </div>
                </div>
                <div>
                    <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                        {actorName}
                    </h1>
                    {actorDetails?.bio && (
                        <p className="text-gray-300 mt-4 max-w-2xl">{actorDetails.bio}</p>
                    )}
                </div>
            </section>

            <section className="mt-8">
                <h2 className="text-3xl font-bold text-white mb-6">{actorMovies.length} {actorMovies.length === 1 ? 'Film' : 'Films'} on Yoruba Cinemax</h2>
                {actorMovies.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {actorMovies.map((movie, index) => (
                            <MovieCard key={movie.id} movie={movie} animationDelay={`${index * 75}ms`} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <h2 className="text-2xl font-bold">No Movies Found</h2>
                        <p>We couldn't find any movies starring {actorName} in our catalog.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default ActorPage;