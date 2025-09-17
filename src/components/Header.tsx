import React, { useState, Fragment } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { MenuIcon, XIcon, SearchIcon, FilmIcon, UserCircleIcon, BookmarkIcon, LogoutIcon, UserIcon } from './icons/Icons';
import SearchBar from './SearchBar';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const { config } = useSiteConfig();

  const baseNavLinks = [
    { name: 'Home', path: '/' },
    { name: 'Trending', path: '/trending' },
    { name: 'Collections', path: '/collections'},
    { name: 'Downloader', path: '/youtube-downloader' },
  ];
  
  const navLinks = config.liveTvEnabled
    ? [...baseNavLinks.slice(0, 2), { name: 'Live TV', path: '/live-tv' }, ...baseNavLinks.slice(2)]
    : baseNavLinks;

  const activeLinkClass = "text-white bg-green-600";
  const inactiveLinkClass = "text-gray-300 hover:bg-gray-700 hover:text-white";

  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setIsProfileOpen(false);
  }

  return (
    <header className="bg-gray-900 bg-opacity-95 sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <NavLink to="/" className="flex items-center space-x-2 text-2xl font-black">
                <span className="p-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg"><FilmIcon/></span>
                <h1 className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                    {config.name}
                </h1>
            </NavLink>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) => 
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
              >
                {link.name}
              </NavLink>
            ))}
             <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-colors duration-300"
              aria-label="Toggle search bar"
            >
              <SearchIcon />
            </button>
            {currentUser ? (
              <div className="relative">
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center justify-center w-10 h-10 bg-gray-700 rounded-full hover:ring-2 hover:ring-green-500 transition-all">
                  {currentUser.profilePic ? (
                    <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-gray-300" />
                  )}
                </button>
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-700">
                    <div className="px-4 py-2 text-sm text-white border-b border-gray-700">
                        Signed in as<br/>
                        <span className="font-semibold">{currentUser.name}</span>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                        <UserCircleIcon className="w-4 h-4" /> My Profile
                    </Link>
                    <Link to="/watchlist" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                        <BookmarkIcon className="w-4 h-4" /> My Watchlist
                    </Link>
                    <button onClick={logout} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                        <LogoutIcon className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
                <div className="flex items-center space-x-2">
                    <Link to="/login" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-700 text-white hover:bg-gray-600">Login</Link>
                    <Link to="/signup" className="px-3 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-500">Sign Up</Link>
                </div>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 text-gray-300 hover:text-white" aria-label="Toggle search bar">
              <SearchIcon />
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-300 hover:text-white" aria-label="Toggle navigation menu">
              {isMenuOpen ? <XIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {isSearchOpen && <div className="pb-4 md:hidden"><SearchBar onSearch={closeAllMenus} /></div>}
        {isSearchOpen && <div className="absolute top-20 left-0 right-0 hidden md:block container mx-auto px-4 pb-4"><SearchBar onSearch={closeAllMenus}/></div>}
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                onClick={closeAllMenus}
                end={link.path === '/'}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-base font-medium ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
              >
                {link.name}
              </NavLink>
            ))}
             <div className="border-t border-gray-700 my-2"></div>
            {currentUser ? (
                <>
                    <div className="px-3 py-2 text-base font-medium text-white">
                        Hi, {currentUser.name}
                    </div>
                     <Link to="/profile" onClick={closeAllMenus} className={`block px-3 py-2 rounded-md text-base font-medium ${inactiveLinkClass}`}>
                        My Profile
                    </Link>
                    <Link to="/watchlist" onClick={closeAllMenus} className={`block px-3 py-2 rounded-md text-base font-medium ${inactiveLinkClass}`}>
                        My Watchlist
                    </Link>
                    <button onClick={() => { logout(); closeAllMenus(); }} className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${inactiveLinkClass}`}>
                        Logout
                    </button>
                </>
            ) : (
                <>
                    <Link to="/login" onClick={closeAllMenus} className={`block px-3 py-2 rounded-md text-base font-medium ${inactiveLinkClass}`}>Login</Link>
                    <Link to="/signup" onClick={closeAllMenus} className={`block px-3 py-2 rounded-md text-base font-medium ${inactiveLinkClass}`}>Sign Up</Link>
                </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;