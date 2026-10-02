import axios from 'axios';

const TOKEN_KEY = 'nb_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

// One axios instance for both back-ends: /api/* → Node, /search/* → Flask (see vite.config.js proxy)
const api = axios.create({ timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Session expired / account suspended → back to login
    if (err.response?.status === 401 && getToken()) {
      setToken(null);
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(err);
  }
);

/** Friendly error message from any API error */
export const errMsg = (err) => err?.response?.data?.message || err?.message || 'Something went wrong';

export default api;
