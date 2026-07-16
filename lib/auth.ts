/**
 * Local authentication module.
 * Uses localStorage for user accounts with simple password hashing.
 * This is a client-side-only auth system suitable for local/intranet use.
 */

import { UserAccount, Role } from '@/lib/types';
import { getStorage, setStorage } from '@/lib/storage';
import { apiFetch } from '@/lib/api-client';

const USERS_KEY = 'endo_users';
const SESSION_KEY = 'endo_session';

// Simple hash function for passwords.
// Uses crypto.subtle when available (HTTPS/localhost), falls back to a basic hash otherwise.
export async function hashPassword(password: string): Promise<string> {
  if (typeof window === 'undefined') return password;
  const salted = password + 'endo_salt_2024';

  // Try crypto.subtle first (only available in secure contexts)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(salted);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to simple hash
    }
  }

  // Fallback: simple djb2-based hash (not cryptographically secure, but fine for intranet auth)
  let hash = 5381;
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash + salted.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export async function getUsers(): Promise<UserAccount[]> {
  try {
    const res = await apiFetch('/api/auth/users');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('getUsers failed:', err);
  }
  return [];
}

export function saveUsers(users: UserAccount[]): void {
  // Deprecated: Users are stored in backend database
}

export function getUserById(id: string): UserAccount | null {
  // Deprecated: Use backend search/endpoints
  return null;
}

export function getUserByUsername(username: string): UserAccount | null {
  // Deprecated: Use backend search/endpoints
  return null;
}

export async function authenticateUser(username: string, password: string): Promise<UserAccount | null> {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        }
        return data.user;
      }
    }
  } catch (err) {
    console.error('authenticateUser failed:', err);
  }
  return null;
}

export async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: Role,
): Promise<UserAccount> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create user');
  }
  const data = await res.json();
  return data.user;
}

export async function updateUser(
  userId: string,
  updates: { displayName?: string; role?: Role; active?: boolean; password?: string },
): Promise<UserAccount | null> {
  const res = await apiFetch(`/api/auth/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error('Failed to update user');
  }
  return null;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const res = await apiFetch(`/api/auth/users/${userId}`, {
    method: 'DELETE',
  });
  return res.ok;
}

// Session management — uses encrypted HTTP-only cookies via API
export function getSession(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(SESSION_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function initSession(): Promise<UserAccount | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await apiFetch('/api/auth');
    if (res.ok) {
      const { user } = await res.json();
      if (user) {
        // Cache in localStorage for synchronous access
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
      }
    }
  } catch {
    // Fallback to localStorage
  }
  return getSession();
}

export function setSession(user: UserAccount): void {
  // Cache locally for synchronous access
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  // Set encrypted cookie via API
  apiFetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user }),
  }).catch((err) => console.error('Failed to set session cookie:', err));
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_KEY);
  }
  // Clear cookie via API
  apiFetch('/api/auth', { method: 'DELETE' }).catch(() => {});
}

// Seed default admin account if no users exist
export async function seedDefaultUsers(): Promise<void> {
  // Deprecated: Seeded by Fastify backend automatically
}
