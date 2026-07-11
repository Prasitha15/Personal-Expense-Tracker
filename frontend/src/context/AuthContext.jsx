import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/users/profile/');
      setUser(res.data);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }

    // Listen to global logout events from api interceptor
    const handleGlobalLogout = () => {
      logout();
    };
    window.addEventListener('auth-logout', handleGlobalLogout);
    return () => window.removeEventListener('auth-logout', handleGlobalLogout);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post('/api/users/login/', { username, password });
      const { access, refresh, email, currency } = res.data;
      
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      
      setUser({ username, email, currency });
      // Fetch fresh profile details
      await fetchProfile();
      return { success: true };
    } catch (err) {
      setLoading(false);
      return {
        success: false,
        error: err.response?.data?.detail || 'Invalid credentials'
      };
    }
  };

  const signup = async (username, email, password, currency) => {
    try {
      await api.post('/api/users/register/', { username, email, password, currency });
      return { success: true };
    } catch (err) {
      const errors = err.response?.data || {};
      const errorMessage = Object.values(errors).flat().join(' ') || 'Signup failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await api.post('/api/users/logout/', { refresh: refreshToken });
      } catch (err) {
        console.error("Failed to blacklist token during logout:", err);
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setLoading(false);
  };

  const updateProfile = async (data) => {
    try {
      const res = await api.patch('/api/users/profile/', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUser(res.data);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data || 'Failed to update profile'
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
