'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { setFolderHandle } from '@/lib/local-folder-bridge';

interface LocalFolderContextValue {
  /** The selected directory handle, or null if not yet selected */
  dirHandle: FileSystemDirectoryHandle | null;
  /** Whether the File System Access API is supported */
  isSupported: boolean;
  /** Whether a folder has been selected */
  hasFolder: boolean;
  /** Prompt the user to pick a folder */
  pickFolder: () => Promise<FileSystemDirectoryHandle | null>;
  /** Try to restore the previously selected folder (requires user gesture on first call) */
  restoreFolder: () => Promise<FileSystemDirectoryHandle | null>;
  /** Write a file to the selected folder */
  writeFile: (subPath: string, data: Blob | string) => Promise<boolean>;
  /** Read a file from the selected folder */
  readFile: (subPath: string) => Promise<Blob | null>;
  /** List files in a subdirectory */
  listFiles: (subPath: string) => Promise<string[]>;
  /** Check if a file exists */
  fileExists: (subPath: string) => Promise<boolean>;
  /** Delete a file */
  deleteFile: (subPath: string) => Promise<boolean>;
}

const LocalFolderContext = createContext<LocalFolderContextValue | undefined>(undefined);

const DB_NAME = 'endo_fs_handle';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'root_dir';

// Store the directory handle in IndexedDB so we can restore it across sessions
async function saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      getReq.onsuccess = () => resolve(getReq.result as FileSystemDirectoryHandle | null ?? null);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getSubDir(root: FileSystemDirectoryHandle, subPath: string): Promise<FileSystemDirectoryHandle> {
  const parts = subPath.split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

export function LocalFolderProvider({ children }: { children: React.ReactNode }) {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Sync the bridge whenever dirHandle changes
  useEffect(() => {
    setFolderHandle(dirHandle);
  }, [dirHandle]);

  // Try to restore on mount
  useEffect(() => {
    if (!isSupported) return;
    getHandleFromIDB().then((handle) => {
      if (handle) {
        // Verify we still have permission
        (handle as unknown as { queryPermission: (opts: object) => Promise<string> }).queryPermission({ mode: 'readwrite' }).then((perm: string) => {
          if (perm === 'granted') {
            setDirHandle(handle);
          }
        });
      }
    }).catch(() => {});
  }, [isSupported]);

  const pickFolder = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!isSupported) {
      toast.error('Your browser does not support local folder access. Use Chrome or Edge.');
      return null;
    }
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });
      await saveHandleToIDB(handle);
      setDirHandle(handle);
      toast.success(`Folder selected: ${handle.name}`);
      return handle;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Failed to select folder.');
      }
      return null;
    }
  }, [isSupported]);

  const restoreFolder = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!isSupported) return null;
    const handle = await getHandleFromIDB();
    if (!handle) return null;

    const perm = await (handle as unknown as { requestPermission: (opts: object) => Promise<string> }).requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      setDirHandle(handle);
      return handle;
    }
    return null;
  }, [isSupported]);

  const writeFile = useCallback(async (subPath: string, data: Blob | string): Promise<boolean> => {
    if (!dirHandle) return false;
    try {
      const parts = subPath.split('/');
      const fileName = parts.pop()!;
      const dirPath = parts.join('/');
      const dir = dirPath ? await getSubDir(dirHandle, dirPath) : dirHandle;
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch (err) {
      console.error('writeFile failed:', err);
      return false;
    }
  }, [dirHandle]);

  const readFile = useCallback(async (subPath: string): Promise<Blob | null> => {
    if (!dirHandle) return null;
    try {
      const parts = subPath.split('/');
      const fileName = parts.pop()!;
      const dirPath = parts.join('/');
      const dir = dirPath ? await getSubDir(dirHandle, dirPath) : dirHandle;
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return file;
    } catch {
      return null;
    }
  }, [dirHandle]);

  const listFiles = useCallback(async (subPath: string): Promise<string[]> => {
    if (!dirHandle) return [];
    try {
      const dir = subPath ? await getSubDir(dirHandle, subPath) : dirHandle;
      const names: string[] = [];
      for await (const entry of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        const [name, handle] = entry;
        if (handle.kind === 'file') names.push(name);
      }
      return names;
    } catch {
      return [];
    }
  }, [dirHandle]);

  const fileExists = useCallback(async (subPath: string): Promise<boolean> => {
    if (!dirHandle) return false;
    try {
      const parts = subPath.split('/');
      const fileName = parts.pop()!;
      const dirPath = parts.join('/');
      const dir = dirPath ? await getSubDir(dirHandle, dirPath) : dirHandle;
      await dir.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }, [dirHandle]);

  const deleteFile = useCallback(async (subPath: string): Promise<boolean> => {
    if (!dirHandle) return false;
    try {
      const parts = subPath.split('/');
      const fileName = parts.pop()!;
      const dirPath = parts.join('/');
      const dir = dirPath ? await getSubDir(dirHandle, dirPath) : dirHandle;
      await dir.removeEntry(fileName);
      return true;
    } catch {
      return false;
    }
  }, [dirHandle]);

  const value = useMemo(() => ({
    dirHandle,
    isSupported,
    hasFolder: dirHandle !== null,
    pickFolder,
    restoreFolder,
    writeFile,
    readFile,
    listFiles,
    fileExists,
    deleteFile,
  }), [dirHandle, isSupported, pickFolder, restoreFolder, writeFile, readFile, listFiles, fileExists, deleteFile]);

  return <LocalFolderContext.Provider value={value}>{children}</LocalFolderContext.Provider>;
}

export function useLocalFolder() {
  const context = useContext(LocalFolderContext);
  if (!context) {
    throw new Error('useLocalFolder must be used within LocalFolderProvider');
  }
  return context;
}
