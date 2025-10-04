import React from 'react';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = "Loading..."}) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 text-gray-400">
      <div className="w-8 h-8 border-4 border-gray-600 border-t-green-500 rounded-full animate-spin"></div>
      <span>{text}</span>
    </div>
  );
};

export default LoadingSpinner;