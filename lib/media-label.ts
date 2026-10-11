export function filenameStem(filename: string) {
  return filename.replace(/\.[^/.]+$/, '');
}

export function isDefaultMediaLabel(item: { label?: string | null; filename: string }) {
  const label = item.label?.trim() ?? '';
  if (!label) return true;
  if (/^(Image|Video|Report)\s+\d+$/i.test(label)) return true;
  const stem = filenameStem(item.filename);
  return label === stem || label === item.filename;
}

export function getPrintableMediaLabel(item: { label?: string | null; filename: string }) {
  if (isDefaultMediaLabel(item)) return null;
  return item.label?.trim() || null;
}

export function displayMediaLabel(item: { label?: string | null; filename: string }) {
  return item.label?.trim() || filenameStem(item.filename) || item.filename;
}
