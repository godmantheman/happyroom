export interface User {
  id: number;
  username: string;
  role: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  author_id: number;
  author_name: string;
  created_at: string;
}

export interface Message {
  id: number;
  userId: number;
  username: string;
  text: string;
  created_at: string;
}

export type AuthState = {
  user: User | null;
  token: string | null;
};
