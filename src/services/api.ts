import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Troque pelo IP da sua máquina na rede local (onde o backend está rodando)
// Para web (expo start --web) use: http://localhost:8000/api
export const API_URL = 'http://10.100.10.187:8000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
