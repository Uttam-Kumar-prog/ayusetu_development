import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingAuth, setPendingAuth] = useState(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('access_token');
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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('ayur_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const completeLogin = (payload) => {
    const normalizedUser = payload?.user || null;

    if (payload?.accessToken) {
      localStorage.setItem('access_token', payload.accessToken);
      localStorage.setItem('token', payload.accessToken); // backward compatibility
    }
    if (payload?.refreshToken) {
      localStorage.setItem('refresh_token', payload.refreshToken);
    }

    if (normalizedUser) {
      setUser(normalizedUser);
      localStorage.setItem('ayur_user', JSON.stringify(normalizedUser));
    }

    setPendingAuth(null);
    return normalizedUser;
  };

  const startOtpFlow = (payload) => {
    const state = {
      otpFlowToken: payload?.otpFlowToken || '',
      expiresAt: payload?.expiresAt || null,
      resendAfterSeconds: payload?.resendAfterSeconds ?? 0,
      email: payload?.email || '',
      purpose: payload?.purpose || 'login',
    };
    setPendingAuth(state);
    sessionStorage.setItem('pending_auth', JSON.stringify(state));
    return state;
  };

  const hydratePendingAuth = () => {
    if (pendingAuth) return pendingAuth;
    try {
      const stored = sessionStorage.getItem('pending_auth');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      setPendingAuth(parsed);
      return parsed;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await authAPI.logout({ refreshToken });
      } catch {}
    }
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('ayur_user');
    sessionStorage.removeItem('pending_auth');
    setPendingAuth(null);
  };

  const clearPendingAuth = () => {
    sessionStorage.removeItem('pending_auth');
    setPendingAuth(null);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('ayur_user', JSON.stringify(nextUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        completeLogin,
        startOtpFlow,
        pendingAuth,
        hydratePendingAuth,
        clearPendingAuth,
        logout,
        updateUser,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
