/**
 * Central API client configuration.
 *
 * The browser talks to the Next.js server (same origin) which already has
 * API routes at /api/storage/[key], /api/media, /api/auth, etc.
 * These Next.js routes store data on the server filesystem.
 *
 * This means NO cross-origin requests, NO CORS issues, NO certificate problems.
 * The backend (Fastify on port 4000) can be used directly for advanced operations
 * or as a future migration target, but the frontend uses same-origin routes.
 */

/**
 * Build a full API URL. Since we use same-origin Next.js API routes,
 * paths like '/api/storage/xxx' go directly to the same server.
 */
export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return path; // Same origin — just use the relative path
}

/**
 * Fetch wrapper. Same origin so no special credentials needed.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const options: RequestInit = {
    cache: 'no-store',
    ...init,
    headers: {
      ...init?.headers,
    },
  };
  return fetch(apiUrl(path), options);
}
