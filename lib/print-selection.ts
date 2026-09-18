import type { MediaFile } from '@/lib/types';

export type PrintMode = 'report-5' | 'report-6' | 'images-only' | 'images-15';

export type PrintPick = {
  id: string;
  filename: string;
};

export type StoredPrintVisit = {
  version: 2;
  mode: PrintMode;
  selections: Partial<Record<PrintMode, PrintPick[]>>;
  updatedAt: string;
};

const memory = new Map<string, StoredPrintVisit>();

function visitKey(sessionId: string) {
  return `endo_print_visit_${sessionId}`;
}

function modeKey(sessionId: string, mode: string) {
  return `endo_print_sel_${sessionId}_${mode}`;
}

function isPrintMode(value: unknown): value is PrintMode {
  return value === 'report-5' || value === 'report-6' || value === 'images-only' || value === 'images-15';
}

function readJson(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — in-memory map still holds the visit */
  }
}

function idsToPicks(ids: unknown, media: MediaFile[] = []): PrintPick[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => {
      if (typeof id !== 'string' || !id) return null;
      const match = media.find((item) => item.id === id);
      return { id, filename: match?.filename ?? '' };
    })
    .filter((item): item is PrintPick => Boolean(item));
}

function migrateLegacy(sessionId: string, media: MediaFile[]): StoredPrintVisit {
  const storedMode = readJson(`endo_print_mode_${sessionId}`);
  const mode: PrintMode = isPrintMode(storedMode)
    ? storedMode
    : storedMode === 'with-content'
      ? 'report-5'
      : 'report-5';

  const selections: StoredPrintVisit['selections'] = {};
  const modes: PrintMode[] = ['report-5', 'report-6', 'images-only', 'images-15'];
  for (const nextMode of modes) {
    const raw = readJson(modeKey(sessionId, nextMode));
    if (Array.isArray(raw)) selections[nextMode] = idsToPicks(raw, media);
  }

  const legacyContent = readJson(modeKey(sessionId, 'with-content'));
  if (!selections['report-5'] && Array.isArray(legacyContent)) {
    selections['report-5'] = idsToPicks(legacyContent, media);
  }

  return {
    version: 2,
    mode,
    selections,
    updatedAt: new Date().toISOString(),
  };
}

export function getModeLimit(mode: PrintMode) {
  switch (mode) {
    case 'report-5':
      return 5;
    case 'report-6':
      return 6;
    case 'images-15':
      return 15;
    case 'images-only':
    default:
      return 12;
  }
}

export function loadPrintVisit(sessionId: string, media: MediaFile[] = []): StoredPrintVisit {
  const cached = memory.get(sessionId);
  if (cached) return cached;

  const stored = readJson(visitKey(sessionId));
  if (stored && typeof stored === 'object' && (stored as StoredPrintVisit).version === 2) {
    const visit = stored as StoredPrintVisit;
    const next: StoredPrintVisit = {
      version: 2,
      mode: isPrintMode(visit.mode) ? visit.mode : 'report-5',
      selections: visit.selections ?? {},
      updatedAt: visit.updatedAt || new Date().toISOString(),
    };
    memory.set(sessionId, next);
    return next;
  }

  const migrated = migrateLegacy(sessionId, media);
  memory.set(sessionId, migrated);
  writeJson(visitKey(sessionId), migrated);
  return migrated;
}

export function savePrintVisit(sessionId: string, visit: StoredPrintVisit) {
  const next = { ...visit, version: 2 as const, updatedAt: new Date().toISOString() };
  memory.set(sessionId, next);
  writeJson(visitKey(sessionId), next);
  writeJson(`endo_print_mode_${sessionId}`, next.mode);
  const picks = next.selections[next.mode] ?? [];
  writeJson(modeKey(sessionId, next.mode), picks.map((item) => item.id));
}

export function resolvePrintPicks(picks: PrintPick[] | undefined, media: MediaFile[], limit: number) {
  if (!picks?.length || media.length === 0) return [];
  const used = new Set<string>();
  const resolved: string[] = [];

  for (const pick of picks) {
    if (resolved.length >= limit) break;
    const byId = media.find((item) => item.id === pick.id);
    if (byId && !used.has(byId.id)) {
      used.add(byId.id);
      resolved.push(byId.id);
      continue;
    }
    if (pick.filename) {
      const byName = media.find((item) => item.filename === pick.filename && !used.has(item.id));
      if (byName) {
        used.add(byName.id);
        resolved.push(byName.id);
      }
    }
  }

  return resolved;
}

export function hasStoredPrintPicks(sessionId: string, mode: PrintMode) {
  const visit = loadPrintVisit(sessionId);
  return Object.prototype.hasOwnProperty.call(visit.selections, mode);
}

export function toPrintPicks(ids: string[], media: MediaFile[]): PrintPick[] {
  return ids.map((id) => {
    const match = media.find((item) => item.id === id);
    return { id, filename: match?.filename ?? '' };
  });
}

export function rememberPrintSelection(
  sessionId: string,
  mode: PrintMode,
  ids: string[],
  media: MediaFile[],
) {
  const visit = loadPrintVisit(sessionId, media);
  visit.mode = mode;
  visit.selections[mode] = toPrintPicks(ids, media);
  savePrintVisit(sessionId, visit);
}

export function restorePrintSelection(
  sessionId: string,
  mode: PrintMode,
  media: MediaFile[],
  limit: number,
) {
  const visit = loadPrintVisit(sessionId, media);
  if (visit.mode !== mode) {
    visit.mode = mode;
    savePrintVisit(sessionId, visit);
  }

  if (Object.prototype.hasOwnProperty.call(visit.selections, mode)) {
    return resolvePrintPicks(visit.selections[mode], media, limit);
  }

  if (mode === 'report-6' && visit.selections['report-5']?.length) {
    return resolvePrintPicks(visit.selections['report-5'], media, limit);
  }
  if (mode === 'report-5' && visit.selections['report-6']?.length) {
    return resolvePrintPicks(visit.selections['report-6'], media, limit);
  }
  if (mode === 'images-15' && visit.selections['images-only']?.length) {
    return resolvePrintPicks(visit.selections['images-only'], media, limit);
  }
  if (mode === 'images-only' && visit.selections['images-15']?.length) {
    return resolvePrintPicks(visit.selections['images-15'], media, limit);
  }

  return media.slice(0, limit).map((item) => item.id);
}
