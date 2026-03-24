import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4350';
const TOKEN_KEY = 'sf_auth_token';
const OFFLINE_QUEUE_KEY = 'sf_offline_queue';

// ── Token management ──

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── API calls ──

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  offlineKey?: string; // If set, queues the request when offline
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await getToken();
  const { method = 'GET', body, headers = {}, offlineKey } = options;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, fetchOptions);

    if (res.status === 401) {
      await clearToken();
      throw new ApiError('Authentication required', 401);
    }

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data.error ?? 'Request failed', res.status);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    // Network error — queue for offline sync if offlineKey provided
    if (offlineKey && method !== 'GET') {
      await queueOffline({
        path,
        method,
        body,
        key: offlineKey,
        createdAt: new Date().toISOString(),
      });
      return { queued: true } as T;
    }

    throw new ApiError('Network error', 0);
  }
}

// ── Offline queue ──

interface QueuedRequest {
  path: string;
  method: string;
  body: unknown;
  key: string;
  createdAt: string;
}

async function queueOffline(request: QueuedRequest): Promise<void> {
  const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  const queue: QueuedRequest[] = existing ? JSON.parse(existing) : [];
  queue.push(request);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function getOfflineQueue(): Promise<QueuedRequest[]> {
  const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function flushOfflineQueue(): Promise<{ processed: number; failed: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const req of queue) {
    try {
      await api(req.path, { method: req.method as ApiOptions['method'], body: req.body });
      processed++;
    } catch {
      failed++;
    }
  }

  // Clear processed items, keep failed ones
  if (failed === 0) {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  }

  return { processed, failed };
}

// ── Error class ──

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}
