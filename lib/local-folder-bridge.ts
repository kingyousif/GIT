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

async function getSubDir(root: FileSystemDirectoryHandle, subPath: string): Promise<FileSystemDirectoryHandle> {
  const parts = subPath.split('/').filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
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
    await writable.write(data);
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
    const dir = dirPath ? await getSubDir(_dirHandle, dirPath) : _dirHandle;
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * List files in a subdirectory of the local folder.
 */
export async function listLocalFolder(subPath: string): Promise<string[]> {
  if (!_dirHandle) return [];
  try {
    const dir = subPath ? await getSubDir(_dirHandle, subPath) : _dirHandle;
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
 * Delete a file from the local folder.
 */
export async function deleteFromLocalFolder(subPath: string): Promise<boolean> {
  if (!_dirHandle) return false;
  try {
    const parts = subPath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    const dir = dirPath ? await getSubDir(_dirHandle, dirPath) : _dirHandle;
    await dir.removeEntry(fileName);
    return true;
  } catch {
    return false;
  }
}

export function hasLocalFolder(): boolean {
  return _dirHandle !== null;
}
