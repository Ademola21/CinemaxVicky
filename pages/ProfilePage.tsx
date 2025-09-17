
import React, { useState, useEffect } from 'react';
// FIX: react-router-dom v6 uses useNavigate instead of useHistory.
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as storage from '../services/storageService';
import BackButton from '../components/BackButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { UserCircleIcon, UserIcon } from '../components/icons/Icons';

const ProfilePage: React.FC = () => {
  const { currentUser, updateCurrentUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [profilePic, setProfilePic] = useState(currentUser?.profilePic || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else {
        setName(currentUser.name);
        setUsername(currentUser.username);
        setProfilePic(currentUser.profilePic || '');
    }
  }, [currentUser, navigate]);

  const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const updatedUser = await storage.updateUserProfile({ name, username, profilePic });
      updateCurrentUser(updatedUser);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError((err as Error).message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!currentUser) {
    return <div className="flex justify-center items-center h-full py-20"><LoadingSpinner text="Redirecting..." /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <BackButton />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
            My Profile
        </h1>
        <p className="text-gray-400">Manage your account details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800/50 border border-gray-700 p-8 rounded-lg">
        <div className="flex flex-col items-center space-y-4">
            <div className="relative w-32 h-32">
                {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                    <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                        <UserIcon className="w-16 h-16 text-gray-500" />
                    </div>
                )}
                <label htmlFor="profilePicUpload" className="absolute bottom-0 right-0 bg-green-600 p-2 rounded-full cursor-pointer hover:bg-green-500 transition-colors">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z M5 14a1 1 0 11-2 0 1 1 0 012 0zM3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                    <input type="file" id="profilePicUpload" className="hidden" accept="image/*" onChange={handlePictureUpload} />
                </label>
            </div>
        </div>
        
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300">Display Name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300">Username</label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="^[a-zA-Z0-9_]{3,25}$"
            title="Username must be 3-25 characters and can only contain letters, numbers, and underscores (e.g., ademola_001)."
            className="mt-1 w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
            <input
                id="email"
                type="email"
                disabled
                value={currentUser.email}
                className="mt-1 w-full px-3 py-2 text-gray-400 bg-gray-900 border border-gray-700 rounded-md cursor-not-allowed"
            />
        </div>
        
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        {success && <p className="text-sm text-green-400 text-center">{success}</p>}
        
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-lg font-semibold text-white bg-green-600 rounded-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
