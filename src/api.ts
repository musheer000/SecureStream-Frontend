import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://securestream-backend.onrender.com/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string | null, refresh: string | null) => {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('securestream_access', access);
  } else {
    localStorage.removeItem('securestream_access');
  }
  if (refresh) {
    localStorage.setItem('securestream_refresh', refresh);
  } else {
    localStorage.removeItem('securestream_refresh');
  }
};

export const getAccessToken = () => accessToken || localStorage.getItem('securestream_access');
export const getRefreshToken = () => refreshToken || localStorage.getItem('securestream_refresh');

// Interceptor to inject JWT Access Token into request headers
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle Token Rotation silently on 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const currentRefresh = getRefreshToken();
      if (currentRefresh) {
        try {
          // Attempt Token Rotation
          const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken: currentRefresh,
          });
          const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
          setTokens(newAccess, newRefresh);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch (refreshErr) {
          setTokens(null, null);
          window.dispatchEvent(new Event('auth_logout'));
          return Promise.reject(refreshErr);
        }
      }
    }
    return Promise.reject(error);
  }
);
