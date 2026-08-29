import api from './api';
import { Restaurant } from '../types';

export async function getPublicRestaurants(search?: string): Promise<Restaurant[]> {
  const params = search ? { search } : {};
  const res = await api.get('/restaurants/public/', { params });
  return res.data.data;
}
