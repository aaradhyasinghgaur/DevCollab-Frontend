import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAuthToken, getAuthToken } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    if (data && data.token) {
      setAuthToken(data.token);
      setTokenState(data.token);
      const profile = await authApi.getMe();
      setUser(profile);
      return profile;
    }
    throw new Error('Authentication response did not contain a valid token');
  };

  const register = async (userData) => {
    const data = await authApi.register(userData);
    if (data && data.token) {
      setAuthToken(data.token);
      setTokenState(data.token);
      const profile = await authApi.getMe();
      setUser(profile);
      return profile;
    }
    throw new Error('Registration response did not contain a valid token');
  };

  const loginWithToken = async (newToken) => {
    if (!newToken) return null;
    setAuthToken(newToken);
    setTokenState(newToken);
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      return profile;
    } catch (err) {
      console.error('Failed to fetch user with oauth token:', err);
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      throw err;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    loginWithToken,
    logout,
    refreshUser: fetchCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
