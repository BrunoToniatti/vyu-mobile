export interface UserApp {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone_number: string;
  photo_url?: string | null;
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
}

export interface ApiResponse<T> {
  status: string;
  status_code: number;
  data: T;
}

export interface Review {
  id: number;
  user_name: string;
  user_photo_url?: string | null;
  stars: number;
  comment: string;
  manager_response?: string | null;
  created_at: string;
}
