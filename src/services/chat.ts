import api from './api';
import { ChatMessage } from '../types';

export interface ChatResponse {
  messages: ChatMessage[];
  nextResetAt: string | null;
  wasReset: boolean;
}

export async function getChatMessages(restaurantId: number, since?: number): Promise<ChatResponse> {
  const params: Record<string, string> = {};
  if (since !== undefined) params.since = String(since);
  const res = await api.get(`/restaurants/public/${restaurantId}/chat/`, { params });
  return {
    messages: res.data.data as ChatMessage[],
    nextResetAt: res.data.next_reset_at ?? null,
    wasReset: res.data.was_reset ?? false,
  };
}

export async function sendChatMessage(restaurantId: number, text: string): Promise<ChatMessage> {
  const res = await api.post(`/restaurants/public/${restaurantId}/chat/send/`, { text });
  return res.data.data as ChatMessage;
}
