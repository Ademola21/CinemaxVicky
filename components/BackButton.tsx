
import React from 'react';
// FIX: react-router-dom v5 uses useHistory instead of useNavigate.
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from './icons/Icons';

const BackButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="mb-6 inline-flex items-center gap-2 text-gray-300 hover:text-green-400 transition-colors duration-200"
      aria-label="Go back to the previous page"
    >
      <ChevronLeftIcon className="w-5 h-5" />
      <span className="font-semibold text-sm">Back</span>
    </button>
  );
};

export default BackButton;