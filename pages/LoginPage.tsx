
import React, { useState, useEffect } from 'react';
// FIX: react-router-dom v5 uses useHistory instead of useNavigate.
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FilmIcon } from '../components/icons/Icons';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, currentUser } = useAuth();

  const from = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (currentUser) {
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(email, password);
      if (!user) {
        setError('Invalid email or password. Please try again.');
      }
      // Successful login is handled by the useEffect hook
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
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400">Log in to continue to Yoruba Cinemax</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Email Address"
              className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="password"className="text-sm font-medium text-gray-300 sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-400">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-green-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
