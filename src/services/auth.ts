import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { UserApp } from '../types';

export async function loginUser(identifier: string, password: string): Promise<void> {
  const res = await api.post('/auth/app/login/', { identifier, password });
  const { access, refresh, user } = res.data.data;
  await AsyncStorage.multiSet([
    ['access_token', access],
    ['refresh_token', refresh],
    ['user', JSON.stringify(user)],
  ]);
}

export async function registerUser(data: {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone_number: string;
  password: string;
}): Promise<void> {
  await api.post('/users/', data);
}

export async function getStoredUser(): Promise<UserApp | null> {
  const raw = await AsyncStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem('access_token');
  return !!token;
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
}

export async function uploadUserPhoto(uri: string): Promise<UserApp> {
  const filename = uri.split('/').pop() ?? 'photo.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type = mimeMap[ext] ?? 'image/jpeg';

  const formData = new FormData();
  formData.append('photo', { uri, name: filename, type } as any);

  const res = await api.post('/users/me/photo/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const updatedUser: UserApp = res.data.data;
  await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  return updatedUser;
}

export async function removeUserPhoto(): Promise<UserApp> {
  const res = await api.delete('/users/me/photo/');
  const updatedUser: UserApp = res.data.data ?? (await getStoredUser());
  await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  return updatedUser;
}
