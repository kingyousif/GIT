'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { MediaFile } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';

export interface UploadProgress {
  isUploading: boolean;
  totalFiles: number;
  uploadedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  currentFile: string;
  speed: number; // bytes per second
  startedAt: number;
}

const initialProgress: UploadProgress = {
  isUploading: false,
  totalFiles: 0,
  uploadedFiles: 0,
  totalBytes: 0,
  uploadedBytes: 0,
  currentFile: '',
  speed: 0,
  startedAt: 0,
};

export interface UploadContext {
  patientName?: string;
  patientCode?: string;
  procedureType?: string;
  scheduledAt?: string;
}

export function useUploadToServer() {
  const [progress, setProgress] = useState<UploadProgress>(initialProgress);
  const [uploadingIds, setUploadingIds] = useState<string[]>([]);

  // Helper to extract a Blob from a MediaFile's dataUrl
  const getBlobFromDataUrl = useCallback(async (dataUrl: string, fallbackFilename?: string): Promise<Blob | null> => {
    try {
      if (dataUrl.startsWith('blob:') || dataUrl.startsWith('data:') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
        const res = await fetch(dataUrl);
        return await res.blob();
      }
      return new Blob([dataUrl], { type: 'text/plain' });
    } catch (err) {
      console.warn(`Could not extract blob for ${fallbackFilename}:`, err);
      return null;
    }
  }, []);

  // Upload a single media file to the backend
  const uploadSingleMedia = useCallback(async (
    item: MediaFile,
    context?: UploadContext,
    onSuccess?: (syncedItem: MediaFile) => void
  ): Promise<boolean> => {
    setUploadingIds((prev) => [...prev, item.id]);

    try {
      const blob = await getBlobFromDataUrl(item.dataUrl, item.filename);
      if (!blob) {
        toast.error(`Cannot read file data for ${item.filename}`);
        return false;
      }

      const formData = new FormData();
      formData.append('sessionId', item.sessionId);
      formData.append('mediaId', item.id);
      formData.append('type', item.type);
      formData.append('filename', item.filename);
      formData.append('source', item.source);
      formData.append('capturedAt', item.capturedAt);
      if (item.label) formData.append('label', item.label);
      if (item.annotations) formData.append('annotations', item.annotations);
      if (context?.patientName) formData.append('patientName', context.patientName);
      if (context?.patientCode) formData.append('patientCode', context.patientCode);
      if (context?.procedureType) formData.append('procedureType', context.procedureType);
      if (context?.scheduledAt) formData.append('scheduledAt', context.scheduledAt);
      formData.append('file', blob, item.filename);

      const res = await apiFetch('/api/media/blob', { method: 'POST', body: formData });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const result = await res.json();
      const updated: MediaFile = {
        ...item,
        isSynced: true,
        size: result?.size || blob.size || item.size,
      };

      if (onSuccess) {
        onSuccess(updated);
      }
      toast.success(`"${item.label || item.filename}" saved to server.`);
      return true;
    } catch (err) {
      console.error(`Failed to upload ${item.filename}:`, err);
      toast.error(`Failed to upload "${item.label || item.filename}" to server.`);
      return false;
    } finally {
      setUploadingIds((prev) => prev.filter((id) => id !== item.id));
    }
  }, [getBlobFromDataUrl]);

  // Upload multiple media items with batch progress tracking
  const uploadMedia = useCallback(async (
    items: MediaFile[],
    context?: UploadContext,
    onItemSynced?: (syncedItem: MediaFile) => void
  ): Promise<{ success: boolean; syncedIds: string[] }> => {
    if (items.length === 0) return { success: true, syncedIds: [] };

    const targetItems = items.filter((item) => !item.isSynced || item.dataUrl.startsWith('blob:') || item.dataUrl.startsWith('data:'));
    const itemsToUpload = targetItems.length > 0 ? targetItems : items;

    // Calculate total size and extract blobs
    let totalBytes = 0;
    const blobs: { media: MediaFile; blob: Blob }[] = [];

    for (const item of itemsToUpload) {
      try {
        const blob = await getBlobFromDataUrl(item.dataUrl, item.filename);
        if (blob) {
          blobs.push({ media: item, blob });
          totalBytes += blob.size;
        }
      } catch {}
    }

    if (blobs.length === 0) {
      toast.info('All media items are already synced with the server.');
      return { success: true, syncedIds: [] };
    }

    const startedAt = Date.now();
    setProgress({
      isUploading: true,
      totalFiles: blobs.length,
      uploadedFiles: 0,
      totalBytes,
      uploadedBytes: 0,
      currentFile: blobs[0]?.media.filename || '',
      speed: 0,
      startedAt,
    });

    setUploadingIds(blobs.map((b) => b.media.id));

    let uploadedBytes = 0;
    let uploadedFiles = 0;
    let allSuccess = true;
    const syncedIds: string[] = [];

    for (const { media, blob } of blobs) {
      setProgress((prev) => ({ ...prev, currentFile: media.filename }));

      try {
        const formData = new FormData();
        formData.append('sessionId', media.sessionId);
        formData.append('mediaId', media.id);
        formData.append('type', media.type);
        formData.append('filename', media.filename);
        formData.append('source', media.source);
        formData.append('capturedAt', media.capturedAt);
        if (media.label) formData.append('label', media.label);
        if (media.annotations) formData.append('annotations', media.annotations);
        if (context?.patientName) formData.append('patientName', context.patientName);
        if (context?.patientCode) formData.append('patientCode', context.patientCode);
        if (context?.procedureType) formData.append('procedureType', context.procedureType);
        if (context?.scheduledAt) formData.append('scheduledAt', context.scheduledAt);
        formData.append('file', blob, media.filename);

        const res = await apiFetch('/api/media/blob', { method: 'POST', body: formData });
        if (!res.ok) {
          allSuccess = false;
        } else {
          syncedIds.push(media.id);
          const result = await res.json().catch(() => null);
          if (onItemSynced) {
            onItemSynced({
              ...media,
              isSynced: true,
              size: result?.size || blob.size || media.size,
            });
          }
        }
      } catch {
        allSuccess = false;
      }

      uploadedBytes += blob.size;
      uploadedFiles += 1;
      const elapsed = (Date.now() - startedAt) / 1000;
      const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;

      setProgress((prev) => ({
        ...prev,
        uploadedFiles,
        uploadedBytes,
        speed,
      }));
    }

    setProgress((prev) => ({ ...prev, isUploading: false }));
    setUploadingIds([]);

    if (allSuccess && syncedIds.length > 0) {
      toast.success(`All ${syncedIds.length} file(s) saved to server.`);
    } else if (syncedIds.length > 0) {
      toast.warning(`${syncedIds.length} of ${blobs.length} file(s) uploaded successfully.`);
    } else {
      toast.error('Failed to upload files to server.');
    }

    return { success: allSuccess, syncedIds };
  }, [getBlobFromDataUrl]);

  const resetProgress = useCallback(() => {
    setProgress(initialProgress);
  }, []);

  return {
    progress,
    uploadingIds,
    uploadMedia,
    uploadSingleMedia,
    resetProgress,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}
