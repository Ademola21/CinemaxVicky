
import React, { useState, useEffect } from 'react';
// FIX: react-router-dom v5 uses useHistory instead of useNavigate.
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as analytics from '../services/analyticsService';
import { FilmIcon } from '../components/icons/Icons';

// Validates a real Gmail address, rejecting "dot" and "plus" aliases.
const validateGmail = (email: string): boolean => {
    if (!email.toLowerCase().endsWith('@gmail.com')) {
        return false; // Must be a gmail.com address
    }
    const username = email.split('@')[0];
    if (username.includes('+')) {
        return false; // No plus aliases
    }
    if (username.length > 6 && username.includes('.')) {
        return false; // No dot aliases (heuristic, as gmail ignores dots)
    }
    return true;
};

const SignUpPage: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();
    const { signup, currentUser } = useAuth();

    const from = (location.state as { from?: string })?.from || '/';

    useEffect(() => {
        if (currentUser) {
            navigate(from, { replace: true });
        }
    }, [currentUser, navigate, from]);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (!validateGmail(email)) {
          setError('Please use a valid Gmail address without "." or "+" aliases.');
          return;
      }
      
      setIsLoading(true);
      try {
        const user = await signup(name, email, password, username);
        if (user) {
          analytics.logSignup();
          // Successful signup is handled by the useEffect hook
        } else {
           // This case may not be hit if signup throws, but good for safety
          setError('Failed to create an account. Please try again.');
        }
      } catch (err) {
        setError((err as Error).message || 'An unexpected error occurred. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
  
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <div className="text-center">
            <div className="inline-block p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mb-4">
                <FilmIcon className="w-8 h-8 text-white"/>
            </div>
            <h1 className="text-3xl font-bold text-white">Create an Account</h1>
            <p className="text-gray-400">Join the Yoruba Cinemax community</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
                <label htmlFor="name" className="text-sm font-medium text-gray-300 sr-only">Full Name</label>
                <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
            <div>
                <label htmlFor="username" className="text-sm font-medium text-gray-300 sr-only">Username</label>
                <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                pattern="^[a-zA-Z0-9_]{3,25}$"
                title="Username must be 3-25 characters and can only contain letters, numbers, and underscores (e.g., ademola_001)."
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-300 sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Gmail Address"
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label htmlFor="password"className="text-sm font-medium text-gray-300 sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 6 characters)"
                className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 text-lg font-semibold text-white bg-green-600 rounded-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </div>
          </form>
  
          <p className="text-sm text-center text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-green-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  };
  
  export default SignUpPage;
