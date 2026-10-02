import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

// Where each role lands after logging in
export const HOME_BY_ROLE = { buyer: '/browse', renter: '/browse', seller: '/seller', admin: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ locations: [], amenities: [], property_types: [] });

  // Restore session on page refresh
  useEffect(() => {
    api.get('/api/meta').then((r) => setMeta(r.data)).catch(() => {});
    if (!getToken()) return setLoading(false);
    api.get('/api/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/api/auth/register', payload);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, meta }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
