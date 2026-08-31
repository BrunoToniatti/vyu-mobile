import api from './api';

export interface CategoryItem {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  items: CategoryItem[];
}

export async function getAllCategories(): Promise<Category[]> {
  const res = await api.get('/categories/');
  return res.data.data;
}

export async function getUserPreferences(): Promise<CategoryItem[]> {
  const res = await api.get('/users/me/preferences/');
  return res.data.data;
}

export async function saveUserPreferences(itemIds: number[]): Promise<void> {
  await api.put('/users/me/preferences/', { preference_ids: itemIds });
}
