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

export function useUploadToServer() {
  const [progress, setProgress] = useState<UploadProgress>(initialProgress);

  const uploadMedia = useCallback(async (items: MediaFile[], context?: { patientName?: string; patientCode?: string; procedureType?: string; scheduledAt?: string }): Promise<boolean> => {
    if (items.length === 0) return true;

    // Calculate total size
    let totalBytes = 0;
    const blobs: { media: MediaFile; blob: Blob }[] = [];

    for (const item of items) {
      try {
        let blob: Blob;
        if (item.dataUrl.startsWith('blob:')) {
          const res = await fetch(item.dataUrl);
          blob = await res.blob();
        } else if (item.dataUrl.startsWith('data:')) {
          const res = await fetch(item.dataUrl);
          blob = await res.blob();
        } else {
          blob = new Blob([item.dataUrl], { type: 'text/plain' });
        }
        blobs.push({ media: item, blob });
        totalBytes += blob.size;
      } catch {
        // Skip items we can't read
      }
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

    let uploadedBytes = 0;
    let uploadedFiles = 0;
    let allSuccess = true;

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
        // Include patient/session context for folder naming on the backend
        if (context?.patientName) formData.append('patientName', context.patientName);
        if (context?.patientCode) formData.append('patientCode', context.patientCode);
        if (context?.procedureType) formData.append('procedureType', context.procedureType);
        if (context?.scheduledAt) formData.append('scheduledAt', context.scheduledAt);
        // File must be last — Fastify's multipart parser reads fields before the file
        formData.append('file', blob, media.filename);

        const res = await apiFetch('/api/media/blob', { method: 'POST', body: formData });
        if (!res.ok) {
          allSuccess = false;
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

    if (allSuccess) {
      toast.success(`All ${uploadedFiles} file(s) uploaded to server.`);
    } else {
      toast.warning('Some files failed to upload.');
    }

    return allSuccess;
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(initialProgress);
  }, []);

  return { progress, uploadMedia, resetProgress };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}
