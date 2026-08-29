export interface UserApp {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone_number: string;
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
}

export interface ApiResponse<T> {
  status: string;
  status_code: number;
  data: T;
}
