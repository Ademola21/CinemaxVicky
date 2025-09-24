
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/types';
import * as storage from '../services/storageService';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (name: string, email: string, password: string, username: string) => Promise<User | null>;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
  updateCurrentUser: (user: User) => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an active session on initial load
    const session = storage.getSession();
    if (session) {
      setCurrentUser(session.user);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const user = await storage.login(email, password);
      setCurrentUser(user);
      return user;
    } catch (error) {
        console.error("Login failed:", error);
        return null;
    }
  };

  const signup = async (name: string, email: string, password: string, username: string): Promise<User | null> => {
    try {
      const newUser = await storage.signup(name, email, password, username);
      setCurrentUser(newUser);
      return newUser;
    } catch (error) {
      console.error("Signup failed:", error);
      // Re-throw the error so the UI can display it
      throw error;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    storage.clearSession();
  };

  const updateCurrentUser = (user: User) => {
    setCurrentUser(user);
    // Also update the session storage so the change persists across reloads
    const session = storage.getSession();
    if (session) {
        storage.createSession({ user, token: session.token });
    }
  };
  
  const isAdmin = currentUser?.role === 'admin';
  const value = { currentUser, login, signup, logout, loading, isAdmin, updateCurrentUser };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
