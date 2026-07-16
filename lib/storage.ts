import { STORAGE_KEYS } from "@/lib/constants";
import { apiFetch } from "@/lib/api-client";

const isBrowser = typeof window !== "undefined";

// In-memory cache — populated from backend
const cache = new Map<string, unknown>();
let essentialsLoaded = false;

/**
 * Load settings, templates, patients, sessions, and reports from backend on startup.
 * Aggressively purges client localStorage to ensure patients/settings reside only on server database.
 */
export async function initStorageCache(force = false): Promise<void> {
  if (!isBrowser) return;
  if (essentialsLoaded && !force) return;

  // Clear client local storage of patients, sessions, reports, templates, settings
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('endo_') && key !== 'endo_session') {
        window.localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('Failed to clear client localStorage:', err);
  }

  const keys = [
    STORAGE_KEYS.settings,
    STORAGE_KEYS.templates,
    STORAGE_KEYS.patients,
    STORAGE_KEYS.sessions,
    STORAGE_KEYS.reports,
    STORAGE_KEYS.seeded,
  ];

  await Promise.all(
    keys.map(async (key) => {
      try {
        const res = await apiFetch(`/api/storage/${encodeURIComponent(key)}`);
        if (res.ok) {
          const value = await res.json();
          if (value !== null) {
            cache.set(key, value);
          }
        }
      } catch (err) {
        console.error(`Failed to load ${key} from server:`, err);
      }
    })
  );

  essentialsLoaded = true;
}

/**
 * Read a value from memory cache. If not found and not essential, starts async fetch from backend.
 */
export function getStorage<T>(key: string): T | null {
  if (!isBrowser) return null;

  if (cache.has(key)) {
    return cache.get(key) as T;
  }

  const isEssentialKey = [
    STORAGE_KEYS.settings,
    STORAGE_KEYS.templates,
    STORAGE_KEYS.patients,
    STORAGE_KEYS.sessions,
    STORAGE_KEYS.reports,
    STORAGE_KEYS.seeded,
  ].includes(key as any);

  if (!isEssentialKey) {
    const fetchingKey = `fetching_${key}`;
    if (!cache.has(fetchingKey)) {
      cache.set(fetchingKey, true);
      apiFetch(`/api/storage/${encodeURIComponent(key)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((value) => {
          cache.delete(fetchingKey);
          if (value !== null) {
            cache.set(key, value);
            window.dispatchEvent(new CustomEvent('endo_storage_update', { detail: { key, value } }));
          }
        })
        .catch((err) => {
          cache.delete(fetchingKey);
          console.error(`Error loading storage key ${key}:`, err);
        });
    }
  }

  return null;
}

/** Update the in-memory cache after a dedicated API operation succeeds. */
export function setStorageCache<T>(key: string, value: T): void {
  if (!isBrowser) return;
  cache.set(key, value);
  window.dispatchEvent(new CustomEvent('endo_storage_update', { detail: { key, value } }));
}

/**
 * Fetch a key from the server and return it. Use this when you need
 * the latest data and can await.
 */
export async function getStorageAsync<T>(key: string): Promise<T | null> {
  if (!isBrowser) return null;

  try {
    const res = await apiFetch(`/api/storage/${encodeURIComponent(key)}`);
    if (res.ok) {
      const value = await res.json();
      if (value !== null) {
        cache.set(key, value);
        return value as T;
      }
    }
  } catch {}

  return null;
}

/**
 * Write a value — updates memory cache and persists directly to backend. No localStorage write.
 */
export async function setStorage<T>(key: string, value: T): Promise<void> {
  if (!isBrowser) return;

  const previous = cache.get(key);
  cache.set(key, value);

  try {
    const res = await apiFetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      throw new Error(`Failed to persist ${key} (${res.status}).`);
    }
  } catch (err) {
    if (previous === undefined) cache.delete(key);
    else cache.set(key, previous);
    console.error(`[Storage] Failed to persist ${key}:`, err);
    throw err;
  }
}

export async function updateStorage<T>(key: string, updater: (prev: T) => T): Promise<void> {
  if (!isBrowser) return;
  const current = getStorage<T>(key);
  const next = updater((current ?? ([] as unknown as T)) as T);
  await setStorage(key, next);
}

/**
 * Delete a value from cache and backend. No localStorage write.
 */
export async function removeStorage(key: string): Promise<void> {
  if (!isBrowser) return;

  console.log(`[Storage] removeStorage called for key: ${key}`);
  cache.delete(key);

  try {
    console.log(`[Storage] Sending DELETE request for key: ${key}...`);
    const res = await apiFetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    console.log(`[Storage] DELETE response status for ${key}:`, res.status, res.statusText);
    if (!res.ok) {
      console.error(`[Storage] Failed to delete ${key}: status ${res.status}`);
    }
  } catch (err) {
    console.error(`[Storage] Failed to delete ${key}:`, err);
  }
}

export function getMediaStorageKey(sessionId: string) {
  return `endo_media_${sessionId}`;
}

export function clearEndoStorage(): void {
  if (!isBrowser) return;

  cache.clear();
  essentialsLoaded = false;

  const preserveKeys = new Set<string>([
    STORAGE_KEYS.users,
    STORAGE_KEYS.session,
  ]);
  const removableKeys = Object.values(STORAGE_KEYS).filter(
    (key) => !preserveKeys.has(key),
  );

  for (const key of removableKeys) {
    removeStorage(key);
  }

  const mediaKeys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("endo_media_")) mediaKeys.push(key);
    }
  } catch {}
  mediaKeys.forEach((key) => removeStorage(key));
}
