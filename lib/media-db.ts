/**
 * Media storage — local folder for fast access + server API for persistence.
 *
 * Flow:
 * 1. Capture media → save to local folder instantly (fast, no network wait)
 * 2. Show in UI immediately from local folder
 * 3. Upload to server in background (or manually via "Upload to Server" button)
 * 4. On refresh: read from local folder. If empty, offer to fetch from server.
 *
 * No IndexedDB. Local folder uses the File System Access API.
 * Server stores files in backend/data/media/ organized by patient/session.
 */

import { MediaFile } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';
import { hasLocalFolder, writeToLocalFolder, listLocalFolder, readFromLocalFolder, deleteFromLocalFolder } from '@/lib/local-folder-bridge';

// ===== Helpers =====

export interface MediaContext {
  patientName?: string;
  patientCode?: string;
  procedureType?: string;
  scheduledAt?: string;
}

function safeName(input: string): string {
  return input.replace(/[<>:"/\\|?*\x00-\x1f\s]+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 80) || 'untitled';
}

function buildSessionFolder(sessionId: string, context?: MediaContext): string {
  if (!context?.patientName) return sessionId; // fallback to sessionId if no context
  const name = safeName(context.patientName);
  const code = safeName(context.patientCode || 'no-code');
  const date = safeName((context.scheduledAt || '').slice(0, 10) || 'no-date');
  const proc = safeName(context.procedureType || 'session');
  return `${name}__${code}__${date}__${proc}`;
}

function getSubfolder(type: MediaFile['type']): string {
  if (type === 'image') return 'images';
  if (type === 'video') return 'videos';
  return 'documents';
}

// ===== Public API =====

/**
 * Get all media items for a session.
 * Tries local folder first, falls back to server.
 */
export async function getMediaForSessionAsync(sessionId: string, context?: MediaContext): Promise<MediaFile[]> {
  // 1. Try local folder first (instant, no network)
  if (hasLocalFolder()) {
    try {
      const folder = buildSessionFolder(sessionId, context);
      const files = await listLocalFolder(folder);
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'));
      if (metaFiles.length > 0) {
        const items: MediaFile[] = [];
        for (const metaFile of metaFiles) {
          const file = await readFromLocalFolder(`${folder}/${metaFile}`);
          if (!file) continue;
          const text = await file.text();
          const meta = JSON.parse(text) as MediaFile & { _folder?: string };

          // Resolve local file reference to a blob URL
          if (meta.dataUrl.startsWith('__local__/')) {
            const localFileName = meta.dataUrl.replace('__local__/', '');
            const blobFile = await readFromLocalFolder(`${folder}/${localFileName}`);
            if (blobFile) {
              meta.dataUrl = URL.createObjectURL(blobFile);
            }
          }
          delete (meta as any)._folder;
          items.push(meta);
        }
        if (items.length > 0) return items;
      }

      // Also try the old flat structure (sessionId as folder) for backward compat
      if (folder !== sessionId) {
        const oldFiles = await listLocalFolder(sessionId);
        const oldMetaFiles = oldFiles.filter((f) => f.endsWith('.meta.json'));
        if (oldMetaFiles.length > 0) {
          const items: MediaFile[] = [];
          for (const metaFile of oldMetaFiles) {
            const file = await readFromLocalFolder(`${sessionId}/${metaFile}`);
            if (!file) continue;
            const text = await file.text();
            const meta = JSON.parse(text) as MediaFile;
            if (meta.dataUrl.startsWith('__local__/')) {
              const localFileName = meta.dataUrl.replace('__local__/', '');
              const blobFile = await readFromLocalFolder(`${sessionId}/${localFileName}`);
              if (blobFile) {
                meta.dataUrl = URL.createObjectURL(blobFile);
              }
            }
            items.push(meta);
          }
          if (items.length > 0) return items;
        }
      }
    } catch (err) {
      console.warn('Failed to read from local folder:', err);
    }
  }

  // 2. If local folder is empty, return empty — component shows "fetch from server" prompt
  return [];
}

/**
 * Check if server has media for a session — lightweight, no file data transferred.
 */
export async function serverHasMediaForSession(sessionId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}&check=true`);
    if (res.ok) {
      const data = await res.json();
      return data?.hasData === true;
    }
  } catch {}
  return false;
}

/**
 * Pull media from server into local folder for fast access.
 * Uses the organized folder structure: PatientName__Code__Date__Procedure/
 */
export async function pullMediaFromServer(sessionId: string, context?: MediaContext): Promise<MediaFile[]> {
  try {
    const res = await apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return [];
    const items: MediaFile[] = await res.json();
    if (items.length === 0) return [];

    // Save to local folder if available — using organized structure
    if (hasLocalFolder()) {
      const folder = buildSessionFolder(sessionId, context);
      for (const item of items) {
        try {
          const sub = getSubfolder(item.type);
          const ext = item.type === 'image' ? 'png' : item.type === 'video' ? 'webm' : 'html';

          if (item.dataUrl && item.dataUrl.startsWith('data:')) {
            const response = await fetch(item.dataUrl);
            const blob = await response.blob();
            // Save file in organized structure
            await writeToLocalFolder(`${folder}/${sub}/${item.id}.${ext}`, blob);
            // Save metadata
            const metaBlob = new Blob(
              [JSON.stringify({ ...item, dataUrl: `__local__/${sub}/${item.id}.${ext}`, _folder: folder })],
              { type: 'application/json' },
            );
            await writeToLocalFolder(`${folder}/${item.id}.meta.json`, metaBlob);
            // Replace dataUrl with blob URL for immediate display
            item.dataUrl = URL.createObjectURL(blob);
          }
        } catch (err) {
          console.warn('Failed to save pulled item to local folder:', err);
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}

/**
 * Delete the local folder for a session (clear local cache).
 * After this, the user can re-fetch from the server.
 */
export async function deleteLocalMediaForSession(sessionId: string, context?: MediaContext): Promise<void> {
  if (!hasLocalFolder()) return;

  const folder = buildSessionFolder(sessionId, context);

  try {
    // List all files in the organized folder and delete them
    const files = await listLocalFolder(folder);
    for (const f of files) {
      await deleteFromLocalFolder(`${folder}/${f}`);
    }
    // Also try subfolders
    for (const sub of ['images', 'videos', 'documents']) {
      try {
        const subFiles = await listLocalFolder(`${folder}/${sub}`);
        for (const f of subFiles) {
          await deleteFromLocalFolder(`${folder}/${sub}/${f}`);
        }
      } catch {}
    }
  } catch {}

  // Also try old flat structure
  if (folder !== sessionId) {
    try {
      const files = await listLocalFolder(sessionId);
      for (const f of files) {
        await deleteFromLocalFolder(`${sessionId}/${f}`);
      }
    } catch {}
  }
}

/**
 * Add a media item — saves to local folder immediately.
 * Server upload happens separately via "Upload to Server" button.
 */
export async function addMediaItemAsync(media: MediaFile, context?: MediaContext): Promise<void> {
  // Save to local folder if available
  if (hasLocalFolder()) {
    try {
      let blob: Blob;
      if (media.dataUrl.startsWith('blob:')) {
        const response = await fetch(media.dataUrl);
        blob = await response.blob();
      } else if (media.dataUrl.startsWith('data:')) {
        const response = await fetch(media.dataUrl);
        blob = await response.blob();
      } else {
        blob = new Blob([media.dataUrl], { type: 'text/plain' });
      }

      const folder = buildSessionFolder(media.sessionId, context);
      const sub = getSubfolder(media.type);
      const ext = media.type === 'image' ? 'png' : media.type === 'video' ? 'webm' : 'html';
      const filePath = `${folder}/${sub}/${media.id}.${ext}`;
      await writeToLocalFolder(filePath, blob);

      // Save metadata
      const metaBlob = new Blob(
        [JSON.stringify({ ...media, dataUrl: `__local__/${sub}/${media.id}.${ext}`, _folder: folder })],
        { type: 'application/json' },
      );
      await writeToLocalFolder(`${folder}/${media.id}.meta.json`, metaBlob);
    } catch (err) {
      console.warn('Failed to save to local folder:', err);
    }
  }
}

/**
 * Update media metadata (label, annotations) — updates local meta + server.
 */
export async function updateMediaItemAsync(mediaId: string, updates: Partial<MediaFile>): Promise<void> {
  const sessionId = updates.sessionId;
  if (!sessionId) return;

  // Update local meta file if available
  if (hasLocalFolder()) {
    try {
      const metaFile = await readFromLocalFolder(`${sessionId}/${mediaId}.meta.json`);
      if (metaFile) {
        const text = await metaFile.text();
        const meta = JSON.parse(text);
        const updated = { ...meta, ...updates };
        const metaBlob = new Blob([JSON.stringify(updated)], { type: 'application/json' });
        await writeToLocalFolder(`${sessionId}/${mediaId}.meta.json`, metaBlob);
      }
    } catch {}
  }

  // Sync to server
  apiFetch('/api/media', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mediaId, updates: { label: updates.label, annotations: updates.annotations } }),
  }).catch(() => {});
}

/**
 * Delete a single media item from local folder + server.
 */
export async function deleteMediaItemAsync(mediaId: string, sessionId?: string): Promise<void> {
  if (!sessionId) return;

  // Delete from local folder
  if (hasLocalFolder()) {
    try {
      // Find and delete the media file + meta
      const files = await listLocalFolder(sessionId);
      for (const f of files) {
        if (f.startsWith(mediaId)) {
          await deleteFromLocalFolder(`${sessionId}/${f}`);
        }
      }
    } catch {}
  }

  // Delete from server
  apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}&mediaId=${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

/**
 * Delete all media for a session.
 */
export async function deleteMediaForSessionAsync(sessionId: string): Promise<void> {
  // Delete local folder contents
  if (hasLocalFolder()) {
    try {
      const files = await listLocalFolder(sessionId);
      for (const f of files) {
        await deleteFromLocalFolder(`${sessionId}/${f}`);
      }
    } catch {}
  }

  // Delete from server
  apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}&deleteAll=true`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Get all media grouped by session (for export — reads from server).
 */
export async function getAllMediaAsync(): Promise<Record<string, MediaFile[]>> {
  try {
    const res = await apiFetch('/api/media?all=true');
    if (res.ok) return await res.json();
  } catch {}
  return {};
}

/**
 * Import media from a backup.
 */
export async function importMediaAsync(media: Record<string, MediaFile[]>): Promise<void> {
  await clearAllMediaAsync();
  const allItems = Object.values(media).flat();
  for (const item of allItems) {
    await apiFetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => {});
  }
}

/**
 * Clear all media from the server.
 */
export async function clearAllMediaAsync(): Promise<void> {
  apiFetch('/api/media?clearAll=true', { method: 'DELETE' }).catch(() => {});
}

/**
 * No-op — no migration needed.
 */
export async function migrateLocalStorageMedia(): Promise<void> {}
