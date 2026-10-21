export interface UserApp {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone_number: string;
  photo_url?: string | null;
}

export interface RestaurantQueue {
  status: 'OPEN' | 'CLOSED' | 'PAUSED';
  status_display: string;
  current_size: number;
  max_capacity: number;
  current_tables: number;
  max_tables: number;
  estimated_wait_minutes: number;
}

export interface Restaurant {
  id: number;
  name: string;
  cnpj: string;
  contact_phone: string;
  address: string;
  site?: string;
  instagram?: string;
  path_logo?: string;
  photo_url?: string | null;
  category_items?: number[];
  latitude?: number | null;
  average_rating?: number | null;
  review_count?: number;
  longitude?: number | null;
  queue?: RestaurantQueue | null;
}

export interface ApiResponse<T> {
  status: string;
  status_code: number;
  data: T;
}

export interface ChatMessage {
  id: number;
  sender_type: 'app_user' | 'restaurant';
  sender_name: string;
  sender_photo?: string | null;
  text: string;
  created_at: string;
}

export interface Review {
  id: number;
  user_id: number;
  user_name: string;
  user_photo_url?: string | null;
  user_email?: string;
  user_phone?: string;
  user_preferences?: { id: number; name: string; category: string }[];
  stars: number;
  comment: string;
  manager_response?: string | null;
  created_at: string;
}

export interface Moment {
  id: number;
  restaurant_id: number;
  restaurant_name: string;
  user_id: number;
  user_name: string;
  user_photo_url?: string | null;
  photo_url: string;
  caption: string;
  is_pinned: boolean;
  liked_by_restaurant: boolean;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface MomentComment {
  id: number;
  user_id: number | null;
  author_name: string;
  author_photo_url?: string | null;
  is_restaurant: boolean;
  text: string;
  created_at: string;
}
