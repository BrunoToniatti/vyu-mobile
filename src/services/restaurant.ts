import api from './api';
import { Restaurant } from '../types';

export async function getPublicRestaurants(search?: string): Promise<Restaurant[]> {
  const params = search ? { search } : {};
  const res = await api.get('/restaurants/public/', { params });
  return res.data.data;
}

export async function getRestaurantReviews(restaurantId: number) {
  const res = await api.get(`/restaurants/public/${restaurantId}/reviews/`);
  return res.data.data;
}

export async function createReview(restaurantId: number, stars: number, comment: string) {
  const res = await api.post(`/restaurants/public/${restaurantId}/reviews/`, { stars, comment });
  return res.data.data;
}

export async function createReservation(
  restaurantId: number,
  data: { date: string; time: string; party_size: number; notes?: string },
) {
  const res = await api.post(`/restaurants/public/${restaurantId}/reservations/`, data);
  return res.data.data;
}

export async function getMyReservations(restaurantId: number) {
  const res = await api.get(`/restaurants/public/${restaurantId}/reservations/`);
  return res.data.data;
}
