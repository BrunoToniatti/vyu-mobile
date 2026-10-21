import api from './api';
import { Moment, MomentComment, Restaurant } from '../types';

export async function getRestaurantMoments(restaurantId: number): Promise<Moment[]> {
  const res = await api.get(`/restaurants/public/${restaurantId}/moments/`);
  return res.data.data;
}

export async function getMomentFeed(): Promise<Moment[]> {
  const res = await api.get('/moments/');
  return res.data.data;
}

export async function getMoment(id: number): Promise<Moment> {
  const res = await api.get(`/moments/${id}/`);
  return res.data.data;
}

export async function createMoment(restaurantId: number, uri: string, caption: string): Promise<Moment> {
  const filename = uri.split('/').pop() ?? 'moment.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type = mimeMap[ext] ?? 'image/jpeg';

  const form = new FormData();
  form.append('photo', { uri, name: filename, type } as any);
  if (caption.trim()) form.append('caption', caption.trim());

  const res = await api.post(`/restaurants/public/${restaurantId}/moments/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function toggleMomentLike(id: number): Promise<{ liked: boolean; like_count: number }> {
  const res = await api.post(`/moments/${id}/like/`);
  return res.data.data;
}

export async function getMomentComments(id: number): Promise<MomentComment[]> {
  const res = await api.get(`/moments/${id}/comments/`);
  return res.data.data;
}

export async function addMomentComment(id: number, text: string): Promise<MomentComment> {
  const res = await api.post(`/moments/${id}/comments/`, { text });
  return res.data.data;
}

export async function deleteMomentComment(id: number, commentId: number): Promise<void> {
  await api.delete(`/moments/${id}/comments/${commentId}/`);
}

export async function deleteMoment(id: number): Promise<void> {
  await api.delete(`/moments/${id}/`);
}

export async function getPublicRestaurant(id: number): Promise<Restaurant> {
  const res = await api.get(`/restaurants/public/${id}/`);
  return res.data.data;
}
