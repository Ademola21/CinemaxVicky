
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FilmIcon, XIcon } from './icons/Icons';

const WelcomePopup: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user is not logged in and if the popup hasn't been dismissed this session
    const hasBeenDismissed = sessionStorage.getItem('welcomePopupDismissed');
    if (!currentUser && !hasBeenDismissed) {
      // Delay the popup slightly to not be too intrusive on page load
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('welcomePopupDismissed', 'true');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        aria-modal="true"
        role="dialog"
    >
        <div className="relative bg-gray-800 border border-gray-700 w-full max-w-md rounded-2xl p-8 text-center shadow-2xl animate-fade-in">
            <button 
                onClick={handleClose} 
                className="absolute top-3 right-3 p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                aria-label="Close welcome message"
            >
                <XIcon className="w-5 h-5" />
            </button>

            <div className="inline-block p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mb-4">
                <FilmIcon className="w-10 h-10 text-white"/>
            </div>
            <h2 className="text-2xl font-bold text-white">Welcome to Yoruba Cinemax!</h2>
            <p className="text-gray-400 mt-2">
                Create a free account to unlock all features, including personalized recommendations, watchlists, commenting, and more.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                    to="/signup"
                    onClick={handleClose}
                    className="w-full bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-500 transition-colors"
                >
                    Create Account
                </Link>
                <Link
                    to="/login"
                    onClick={handleClose}
                    className="w-full bg-gray-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-gray-500 transition-colors"
                >
                    Log In
                </Link>
            </div>
        </div>
    </div>
  );
};

export default WelcomePopup;