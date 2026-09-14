/**
 * Media storage — local folder for fast access + server API for persistence.
 *
 * Media is always keyed by sessionId (the visit). Folder names include the
 * session id so changing a procedure type never mixes two visits.
 */

import { MediaFile } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';
import {
  hasLocalFolder,
  writeToLocalFolder,
  listLocalFolder,
  listLocalDirectories,
  readFromLocalFolder,
  deleteFromLocalFolder,
} from '@/lib/local-folder-bridge';

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
  if (!context?.patientName) return sessionId;
  const name = safeName(context.patientName);
  const code = safeName(context.patientCode || 'no-code');
  const date = safeName((context.scheduledAt || '').slice(0, 10) || 'no-date');
  const proc = safeName(context.procedureType || 'session');
  return `${name}__${code}__${date}__${proc}__${safeName(sessionId)}`;
}

function buildLegacySessionFolder(sessionId: string, context?: MediaContext): string {
  if (!context?.patientName) return sessionId;
  const name = safeName(context.patientName);
  const code = safeName(context.patientCode || 'no-code');
  const date = safeName((context.scheduledAt || '').slice(0, 10) || 'no-date');
  const proc = safeName(context.procedureType || 'session');
  return `${name}__${code}__${date}__${proc}`;
}

function patientFolderPrefix(context?: MediaContext): string {
  if (!context?.patientName) return '';
  return `${safeName(context.patientName)}__${safeName(context.patientCode || 'no-code')}__`;
}

function getSubfolder(type: MediaFile['type']): string {
  if (type === 'image') return 'images';
  if (type === 'video') return 'videos';
  return 'documents';
}

async function readMediaFromFolder(folder: string): Promise<MediaFile[]> {
  const files = await listLocalFolder(folder);
  const metaFiles = files.filter((f) => f.endsWith('.meta.json'));
  if (metaFiles.length === 0) return [];

  const items: MediaFile[] = [];
  for (const metaFile of metaFiles) {
    const file = await readFromLocalFolder(`${folder}/${metaFile}`);
    if (!file) continue;
    try {
      const text = await file.text();
      const meta = JSON.parse(text) as MediaFile & { _folder?: string };

      if (typeof meta.dataUrl === 'string' && meta.dataUrl.startsWith('__local__/')) {
        const localFileName = meta.dataUrl.replace('__local__/', '');
        const blobFile = await readFromLocalFolder(`${folder}/${localFileName}`);
        if (blobFile) {
          meta.dataUrl = URL.createObjectURL(blobFile);
        }
      }
      delete (meta as { _folder?: string })._folder;
      items.push(meta);
    } catch (err) {
      console.warn('Failed to parse media metadata:', err);
    }
  }
  return items;
}

function belongsToSession(item: MediaFile, sessionId: string): boolean {
  return !item.sessionId || item.sessionId === sessionId;
}

async function getCandidateFolders(sessionId: string, context?: MediaContext): Promise<string[]> {
  const folders = new Set<string>();
  folders.add(buildSessionFolder(sessionId, context));
  folders.add(buildLegacySessionFolder(sessionId, context));
  folders.add(sessionId);

  if (!hasLocalFolder()) return [...folders];

  try {
    const dirs = await listLocalDirectories('');
    const prefix = patientFolderPrefix(context);
    const sessionToken = safeName(sessionId);
    for (const dir of dirs) {
      if (dir === sessionId || dir.endsWith(`__${sessionToken}`) || dir.includes(sessionToken)) {
        folders.add(dir);
        continue;
      }
      if (prefix && dir.startsWith(prefix)) {
        folders.add(dir);
      }
    }
  } catch (err) {
    console.warn('Failed to list local media folders:', err);
  }

  return [...folders];
}

async function findAllLocalMediaForSession(sessionId: string, context?: MediaContext): Promise<MediaFile[]> {
  if (!hasLocalFolder()) return [];

  const seen = new Set<string>();
  const items: MediaFile[] = [];
  const folders = await getCandidateFolders(sessionId, context);

  for (const folder of folders) {
    try {
      const folderItems = await readMediaFromFolder(folder);
      for (const item of folderItems) {
        if (!belongsToSession(item, sessionId)) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    } catch (err) {
      console.warn(`Failed to read local media from ${folder}:`, err);
    }
  }

  return items;
}

async function findFolderForMedia(
  mediaId: string,
  sessionId: string,
  context?: MediaContext,
): Promise<string | null> {
  const folders = await getCandidateFolders(sessionId, context);
  for (const folder of folders) {
    const files = await listLocalFolder(folder);
    if (files.includes(`${mediaId}.meta.json`)) return folder;
  }
  return null;
}

async function deleteLocalMediaFiles(folder: string, mediaId: string): Promise<void> {
  const files = await listLocalFolder(folder);
  for (const f of files) {
    if (f.startsWith(mediaId)) {
      await deleteFromLocalFolder(`${folder}/${f}`);
    }
  }
  for (const sub of ['images', 'videos', 'documents']) {
    const subFiles = await listLocalFolder(`${folder}/${sub}`);
    for (const f of subFiles) {
      if (f.startsWith(mediaId)) {
        await deleteFromLocalFolder(`${folder}/${sub}/${f}`);
      }
    }
  }
}

export async function getMediaForSessionAsync(sessionId: string, context?: MediaContext): Promise<MediaFile[]> {
  try {
    const localItems = await findAllLocalMediaForSession(sessionId, context);
    if (localItems.length > 0) return localItems;
  } catch (err) {
    console.warn('Failed to read from local folder:', err);
  }

  return pullMediaFromServer(sessionId, context);
}

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

export async function pullMediaFromServer(sessionId: string, context?: MediaContext): Promise<MediaFile[]> {
  try {
    const res = await apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return [];
    const items: MediaFile[] = await res.json();
    if (items.length === 0) return [];

    if (hasLocalFolder()) {
      const folder = buildSessionFolder(sessionId, context);
      for (const item of items) {
        try {
          const sub = getSubfolder(item.type);
          const ext = item.type === 'image' ? 'png' : item.type === 'video' ? 'webm' : 'html';

          if (item.dataUrl && item.dataUrl.startsWith('data:')) {
            const response = await fetch(item.dataUrl);
            const blob = await response.blob();
            await writeToLocalFolder(`${folder}/${sub}/${item.id}.${ext}`, blob);
            const metaBlob = new Blob(
              [JSON.stringify({ ...item, dataUrl: `__local__/${sub}/${item.id}.${ext}`, _folder: folder })],
              { type: 'application/json' },
            );
            await writeToLocalFolder(`${folder}/${item.id}.meta.json`, metaBlob);
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

export async function deleteLocalMediaForSession(sessionId: string, context?: MediaContext): Promise<void> {
  if (!hasLocalFolder()) return;

  const folders = await getCandidateFolders(sessionId, context);
  for (const folder of folders) {
    try {
      const items = await readMediaFromFolder(folder);
      const hasThis = items.some((item) => belongsToSession(item, sessionId));
      const hasOther = items.some((item) => item.sessionId && item.sessionId !== sessionId);
      if (!hasThis) continue;

      if (hasOther) {
        for (const item of items) {
          if (item.sessionId === sessionId) {
            await deleteLocalMediaFiles(folder, item.id);
          }
        }
        continue;
      }

      const files = await listLocalFolder(folder);
      for (const f of files) {
        await deleteFromLocalFolder(`${folder}/${f}`);
      }
      for (const sub of ['images', 'videos', 'documents']) {
        try {
          const subFiles = await listLocalFolder(`${folder}/${sub}`);
          for (const f of subFiles) {
            await deleteFromLocalFolder(`${folder}/${sub}/${f}`);
          }
        } catch {}
      }
    } catch {}
  }
}

export async function addMediaItemAsync(media: MediaFile, context?: MediaContext): Promise<void> {
  if (!hasLocalFolder()) return;

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

    const metaBlob = new Blob(
      [JSON.stringify({ ...media, dataUrl: `__local__/${sub}/${media.id}.${ext}`, _folder: folder })],
      { type: 'application/json' },
    );
    await writeToLocalFolder(`${folder}/${media.id}.meta.json`, metaBlob);
  } catch (err) {
    console.warn('Failed to save to local folder:', err);
  }
}

export async function updateMediaItemAsync(
  mediaId: string,
  updates: Partial<MediaFile>,
  context?: MediaContext,
): Promise<void> {
  const sessionId = updates.sessionId;
  if (!sessionId) return;

  if (hasLocalFolder()) {
    try {
      const folder = (await findFolderForMedia(mediaId, sessionId, context)) ?? sessionId;
      const metaFile = await readFromLocalFolder(`${folder}/${mediaId}.meta.json`);
      if (metaFile) {
        const text = await metaFile.text();
        const meta = JSON.parse(text);
        const updated = { ...meta, ...updates };
        const metaBlob = new Blob([JSON.stringify(updated)], { type: 'application/json' });
        await writeToLocalFolder(`${folder}/${mediaId}.meta.json`, metaBlob);
      }
    } catch {}
  }

  apiFetch('/api/media', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mediaId, updates: { label: updates.label, annotations: updates.annotations } }),
  }).catch(() => {});
}

export async function deleteMediaItemAsync(
  mediaId: string,
  sessionId?: string,
  context?: MediaContext,
): Promise<void> {
  if (!sessionId) return;

  if (hasLocalFolder()) {
    try {
      const folder = (await findFolderForMedia(mediaId, sessionId, context)) ?? sessionId;
      await deleteLocalMediaFiles(folder, mediaId);
    } catch {}
  }

  apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}&mediaId=${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

export async function deleteMediaForSessionAsync(sessionId: string, context?: MediaContext): Promise<void> {
  await deleteLocalMediaForSession(sessionId, context);
  apiFetch(`/api/media?sessionId=${encodeURIComponent(sessionId)}&deleteAll=true`, { method: 'DELETE' }).catch(() => {});
}

export async function getAllMediaAsync(): Promise<Record<string, MediaFile[]>> {
  try {
    const res = await apiFetch('/api/media?all=true');
    if (res.ok) return await res.json();
  } catch {}
  return {};
}

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

export async function clearAllMediaAsync(): Promise<void> {
  apiFetch('/api/media?clearAll=true', { method: 'DELETE' }).catch(() => {});
}

export async function migrateLocalStorageMedia(): Promise<void> {}
