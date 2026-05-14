import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('ayur_user');

        if (!token) {
          // Do not treat stale profile cache as authenticated without token.
          if (storedUser) {
            localStorage.removeItem('ayur_user');
          }
          setUser(null);
          return;
        }

        const { data } = await authAPI.me();
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('ayur_user', JSON.stringify(data.user));
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('ayur_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = (payload) => {
    const normalizedUser = payload?.user || null;

    if (payload?.token) {
      localStorage.setItem('token', payload.token);
    }

    if (normalizedUser) {
      setUser(normalizedUser);
      localStorage.setItem('ayur_user', JSON.stringify(normalizedUser));
    }

    return normalizedUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('ayur_user');
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('ayur_user', JSON.stringify(nextUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
