import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleSessionExpired } from './session';

export const API_URL = 'https://appealing-rebirth-production-8029.up.railway.app/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired or invalid token (401) means the stored session is no longer valid: send the user to login.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    const hadToken = !!error?.config?.headers?.Authorization;
    if (status === 401 && hadToken && !url.includes('/auth/app/login/')) {
      await handleSessionExpired();
    }
    return Promise.reject(error);
  },
);

export default api;
