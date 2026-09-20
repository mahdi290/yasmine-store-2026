export interface User {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
}
