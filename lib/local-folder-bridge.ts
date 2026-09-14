/**
 * Bridge between the LocalFolder React context and the media-db module.
 * Since media-db.ts can't use React hooks, this module holds a reference
 * to the folder handle that gets set by the LocalFolderProvider.
 */

let _dirHandle: FileSystemDirectoryHandle | null = null;

export function setFolderHandle(handle: FileSystemDirectoryHandle | null) {
  _dirHandle = handle;
}

export function getFolderHandle(): FileSystemDirectoryHandle | null {
  return _dirHandle;
}

async function getSubDir(
  root: FileSystemDirectoryHandle,
  subPath: string,
  create = true,
): Promise<FileSystemDirectoryHandle> {
  const parts = subPath.split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

async function getExistingDir(
  root: FileSystemDirectoryHandle,
  subPath: string,
): Promise<FileSystemDirectoryHandle | null> {
  if (!subPath) return root;
  try {
    return await getSubDir(root, subPath, false);
  } catch {
    return null;
  }
}

/**
 * Write a file to the user's selected local folder.
 * Path is relative, e.g. "patient-code/image-1.png"
 */
export async function writeToLocalFolder(subPath: string, data: Blob): Promise<boolean> {
  if (!_dirHandle) return false;
  try {
    const parts = subPath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    const dir = dirPath ? await getSubDir(_dirHandle, dirPath) : _dirHandle;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    if (data.size > 8 * 1024 * 1024) {
      // Chunk large files (e.g. videos) to prevent Chrome out-of-memory or QuotaExceeded aborts
      const chunkSize = 4 * 1024 * 1024;
      for (let offset = 0; offset < data.size; offset += chunkSize) {
        const chunk = data.slice(offset, Math.min(offset + chunkSize, data.size));
        await writable.write(chunk);
      }
    } else {
      await writable.write(data);
    }
    await writable.close();
    return true;
  } catch (err) {
    console.error('writeToLocalFolder failed:', err);
    return false;
  }
}

/**
 * Read a file from the user's selected local folder.
 */
export async function readFromLocalFolder(subPath: string): Promise<File | null> {
  if (!_dirHandle) return null;
  try {
    const parts = subPath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    const dir = dirPath ? await getExistingDir(_dirHandle, dirPath) : _dirHandle;
    if (!dir) return null;
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * List files in a subdirectory of the local folder.
 * Does not create missing folders.
 */
export async function listLocalFolder(subPath: string): Promise<string[]> {
  if (!_dirHandle) return [];
  try {
    const dir = subPath ? await getExistingDir(_dirHandle, subPath) : _dirHandle;
    if (!dir) return [];
    const names: string[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'file') names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * List immediate subdirectory names. Does not create missing folders.
 */
export async function listLocalDirectories(subPath = ''): Promise<string[]> {
  if (!_dirHandle) return [];
  try {
    const dir = subPath ? await getExistingDir(_dirHandle, subPath) : _dirHandle;
    if (!dir) return [];
    const names: string[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'directory') names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Delete a file from the local folder.
 */
export async function deleteFromLocalFolder(subPath: string): Promise<boolean> {
  if (!_dirHandle) return false;
  try {
    const parts = subPath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    const dir = dirPath ? await getExistingDir(_dirHandle, dirPath) : _dirHandle;
    if (!dir) return false;
    await dir.removeEntry(fileName);
    return true;
  } catch {
    return false;
  }
}

export function hasLocalFolder(): boolean {
  return _dirHandle !== null;
}
