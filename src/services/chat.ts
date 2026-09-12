import api from './api';
import { ChatMessage } from '../types';

export async function getChatMessages(restaurantId: number, since?: number): Promise<ChatMessage[]> {
  const params: Record<string, string> = {};
  if (since !== undefined) params.since = String(since);
  const res = await api.get(`/restaurants/public/${restaurantId}/chat/`, { params });
  return res.data.data as ChatMessage[];
}

export async function sendChatMessage(restaurantId: number, text: string): Promise<ChatMessage> {
  const res = await api.post(`/restaurants/public/${restaurantId}/chat/send/`, { text });
  return res.data.data as ChatMessage;
}
