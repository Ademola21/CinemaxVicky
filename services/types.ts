
export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  profilePic?: string;
  passwordHash: string;
  role?: 'admin' | 'user';
}

export interface Comment {
  id: string;
  parentId?: string | null;
  reviewer: string; // This will be the user's name
  userId: string; // ID of the user who commented
  comment: string;
  date: string;
  rating?: number; // Rating is now optional for replies
  replies: Comment[];
  isAI?: boolean;
}

export interface Upvote {
  commentId: string;
  userIds: string[];
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  downloadLink: string;
  genre: string;
  category: 'Drama' | 'Comedy' | 'Action' | 'Romance' | 'Thriller' | 'Epic';
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

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  movie?: Movie;
  sources?: { uri: string; title: string; }[];
}

export interface MovieContextType {
  movies: Movie[];
  loading: boolean;
  error: string | null;
}

export interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (name: string, email: string, password: string, username: string) => Promise<User | null>;
  logout: () => void;
  loading: boolean;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  movieIds: string[];
}

export interface SiteConfig {
    name: string;
    tagline: string;
    featuredMovieId?: string | null;
    liveTvEnabled: boolean;
    liveTvUrl: string;
    // FIX: Add missing properties to SiteConfig to resolve type errors across the application.
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