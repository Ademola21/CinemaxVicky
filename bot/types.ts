
// This file mirrors some types from the frontend for consistency,
// but is specific to the bot's backend logic.

export interface Movie {
  id: string;
  title: string;
  poster: string;
  downloadLink: string;
  genre: string;
  category: 'Drama' | 'Comedy' | 'Action' | 'Romance' | 'Thriller' | 'Epic' | string;
  releaseDate: string;
  stars: string[];
  runtime: string;
  rating: number;
  description: string;
  popularity: number;
  createdAt: string;
  updatedAt: string;
  trailerId?: string;
  status?: 'coming-soon';
  seriesTitle?: string;
  partNumber?: number;
}

export interface SiteConfig {
    name: string;
    tagline: string;
    featuredMovieId?: string | null;
    liveTvEnabled: boolean;
    liveTvUrl: string;
    copyrightYear: string;
    contact: {
        email: string;
        phone: string;
        address: string;
    };
    socials: {
        platform: string;
        url: string;
    }[];
}

export interface Actor {
    name: string;
    bio: string;
    imageUrl: string;
}

export interface Collection {
    id: string;
    title: string;
    description: string;
    movieIds: string[];
}

export interface User {
    id: string;
    name: string;
    email: string;
}

// Defines the state for a user interacting with the bot in a multi-step process
export interface UserState {
    command: string;
    step?: number;
    movieData?: any; 
    collectionData?: any;
    [key: string]: any;
}