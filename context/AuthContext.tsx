
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserPreferences } from '../types';
import { db } from '../services/db';
import { appConfig } from '../config/appConfig';
import { logger } from '../services/logger';

interface AuthContextType {
  user: User | null;
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const hashPassword = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
        try {
            const storedId = localStorage.getItem('lumina_session_user_id');
            if (storedId) {
              const found = await db.getUserById(storedId);
              if (found) {
                let changed = false;
                if (!found.preferences) { found.preferences = { ...appConfig.defaults.preferences }; changed = true; }
                if (!found.role) { found.role = found.username === 'admin' ? 'admin' : 'user'; changed = true; }
                if (!found.preferences.language) { found.preferences.language = 'English'; changed = true; }
                if (found.bio === undefined) { found.bio = ''; changed = true; }

                if (changed) await db.updateUser(found);
                
                if (found.preferences.useServerStorage !== undefined) {
                    db.setDbConfig(!!found.preferences.useServerStorage, found.preferences.serverUrl || 'http://localhost:8000');
                }
                setUser(found);
              }
            }
        } catch (e) {
            console.error("Auth init failed", e);
        } finally {
            setIsLoading(false);
        }
    };
    initAuth();
  }, []);

  const login = async (username: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const found = await db.findUserByUsername(username);
        if (!found) {
          logger.warn('Auth', `Login failed: User not found`, { username });
          return { success: false, message: 'User not found.' };
        }

        if (found.password) {
            if (password) {
                const hashed = await hashPassword(password);
                if (found.password !== password && found.password !== hashed) {
                    logger.warn('Auth', `Login failed: Incorrect password`, { username });
                    return { success: false, message: 'Incorrect password.' };
                }
            }
        }

        if (found.preferences.useServerStorage !== undefined) {
            db.setDbConfig(!!found.preferences.useServerStorage, found.preferences.serverUrl || 'http://localhost:8000');
        }

        setUser(found);
        localStorage.setItem('lumina_session_user_id', found.id);
        logger.info('Auth', `User logged in`, { username });
        return { success: true };
    } catch (e) {
        logger.error('Auth', `Login error`, e);
        return { success: false, message: 'Login error. Check connection.' };
    }
  };

  const register = async (username: string, password: string, displayName: string): Promise<boolean> => {
    try {
        const existing = await db.findUserByUsername(username);
        if (existing) {
            logger.warn('Auth', `Registration failed: Username taken`, { username });
            return false;
        }

        const hashedPassword = await hashPassword(password);

        const newUser: User = {
          id: crypto.randomUUID(),
          username,
          password: hashedPassword,
          displayName: displayName || username,
          bio: '',
          role: username === 'admin' ? 'admin' : 'user',
          preferences: { ...appConfig.defaults.preferences }
        };
        
        await db.saveUser(newUser);
        setUser(newUser);
        localStorage.setItem('lumina_session_user_id', newUser.id);
        logger.info('Auth', `New user registered`, { username });
        return true;
    } catch (e) {
        logger.error('Auth', `Registration error`, e);
        return false;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    
    if (updates.preferences) {
        if (updates.preferences.useServerStorage !== undefined) {
            db.setDbConfig(
                updates.preferences.useServerStorage, 
                updates.preferences.serverUrl || 'http://localhost:8000'
            );
        }
    }

    await db.updateUser(updatedUser);
  };

  const logout = () => {
    if (user) logger.info('Auth', `User logged out`, { username: user.username });
    setUser(null);
    localStorage.removeItem('lumina_session_user_id');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
