import { createContext, useContext } from 'react';
import { api, setToken, clearToken, getToken } from '../api/client';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  area_postcode?: string;
  commission_rate: number;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<boolean>;
  register: (name: string, pin: string, area: string, phone?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  checkAuth: async () => false,
});

export const useAuth = () => useContext(AuthContext);

// Auth actions (used by provider)
export async function loginAction(name: string, pin: string): Promise<{ user: User; token: string } | null> {
  try {
    const data = await api<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: { name, pin },
    });
    await setToken(data.token);
    return data;
  } catch {
    return null;
  }
}

export async function registerAction(
  name: string, pin: string, area_postcode: string, phone?: string,
): Promise<{ user: User; token: string } | null> {
  try {
    const data = await api<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: { name, pin, area_postcode, phone },
    });
    await setToken(data.token);
    return data;
  } catch {
    return null;
  }
}

export async function checkAuthAction(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await api<User>('/auth/me');
  } catch {
    await clearToken();
    return null;
  }
}

export async function logoutAction(): Promise<void> {
  await clearToken();
}
