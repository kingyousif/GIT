import type { MediaFile } from '@/lib/types';

export type PrintMode = 'report-5' | 'report-6' | 'images-only' | 'images-15';

export type PrintPick = {
  id: string;
  filename: string;
};

export type StoredPrintVisit = {
  version: 3;
  mode: PrintMode;
  selections: Partial<Record<PrintMode, PrintPick[]>>;
  allPicks?: PrintPick[];
  updatedAt: string;
};

const memory = new Map<string, StoredPrintVisit>();

function visitKey(id: string) {
  return `endo_print_visit_${id}`;
}

function modeKey(id: string, mode: string) {
  return `endo_print_sel_${id}_${mode}`;
}

function isPrintMode(value: unknown): value is PrintMode {
  return (
    value === 'report-5' ||
    value === 'report-6' ||
    value === 'images-only' ||
    value === 'images-15'
  );
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

export function idsToPicks(ids: unknown, media: MediaFile[] = []): PrintPick[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => {
      if (typeof id !== 'string' || !id) return null;
      const match = media.find((item) => item.id === id);
      return { id, filename: match?.filename ?? '' };
    })
    .filter((item): item is PrintPick => Boolean(item));
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

export function loadPrintVisit(
  contextId: string,
  media: MediaFile[] = [],
  initialImageIds?: string[],
  initialMode?: string,
): StoredPrintVisit {
  const cached = memory.get(contextId);
  if (cached) {
    if (initialImageIds?.length && (!cached.allPicks?.length || cached.allPicks.length === 0)) {
      cached.allPicks = idsToPicks(initialImageIds, media);
      if (isPrintMode(initialMode)) cached.mode = initialMode;
      cached.selections[cached.mode] = idsToPicks(initialImageIds, media).slice(0, getModeLimit(cached.mode));
    }
    return cached;
  }

  const stored = readJson(visitKey(contextId));
  if (
    stored &&
    typeof stored === 'object' &&
    ((stored as any).version === 2 || (stored as any).version === 3)
  ) {
    const visit = stored as StoredPrintVisit;
    const mode = isPrintMode(initialMode)
      ? initialMode
      : isPrintMode(visit.mode)
        ? visit.mode
        : 'report-5';

    const selections: StoredPrintVisit['selections'] = visit.selections ?? {};
    let allPicks = Array.isArray(visit.allPicks) ? visit.allPicks : [];

    if (initialImageIds?.length && allPicks.length === 0) {
      allPicks = idsToPicks(initialImageIds, media);
      selections[mode] = allPicks.slice(0, getModeLimit(mode));
    }

    const next: StoredPrintVisit = {
      version: 3,
      mode,
      selections,
      allPicks,
      updatedAt: visit.updatedAt || new Date().toISOString(),
    };
    memory.set(contextId, next);
    return next;
  }

  // Fallback: check legacy session keys or initialImageIds
  const storedMode = readJson(`endo_print_mode_${contextId}`);
  const mode: PrintMode = isPrintMode(initialMode)
    ? initialMode
    : isPrintMode(storedMode)
      ? storedMode
      : 'report-5';

  const selections: StoredPrintVisit['selections'] = {};
  const modes: PrintMode[] = ['report-5', 'report-6', 'images-only', 'images-15'];
  for (const nextMode of modes) {
    const raw = readJson(modeKey(contextId, nextMode));
    if (Array.isArray(raw)) selections[nextMode] = idsToPicks(raw, media);
  }

  let allPicks: PrintPick[] = [];
  if (initialImageIds?.length) {
    allPicks = idsToPicks(initialImageIds, media);
    if (!selections[mode]?.length) {
      selections[mode] = allPicks.slice(0, getModeLimit(mode));
    }
  } else {
    for (const m of modes) {
      if (selections[m]?.length) {
        for (const pick of selections[m]!) {
          if (!allPicks.some((p) => p.id === pick.id)) {
            allPicks.push(pick);
          }
        }
      }
    }
  }

  const result: StoredPrintVisit = {
    version: 3,
    mode,
    selections,
    allPicks,
    updatedAt: new Date().toISOString(),
  };
  memory.set(contextId, result);
  writeJson(visitKey(contextId), result);
  return result;
}

export function savePrintVisit(contextId: string, visit: StoredPrintVisit) {
  const next = { ...visit, version: 3 as const, updatedAt: new Date().toISOString() };
  memory.set(contextId, next);
  writeJson(visitKey(contextId), next);
  writeJson(`endo_print_mode_${contextId}`, next.mode);
  const picks = next.selections[next.mode] ?? [];
  writeJson(modeKey(contextId, next.mode), picks.map((item) => item.id));
}

export function resolvePrintPicks(
  picks: PrintPick[] | undefined,
  media: MediaFile[],
  limit: number,
) {
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

export function hasStoredPrintPicks(contextId: string, mode: PrintMode) {
  const visit = loadPrintVisit(contextId);
  return Boolean(
    (visit.selections[mode] && visit.selections[mode]!.length > 0) ||
      (visit.allPicks && visit.allPicks.length > 0),
  );
}

export function toPrintPicks(ids: string[], media: MediaFile[]): PrintPick[] {
  return ids.map((id) => {
    const match = media.find((item) => item.id === id);
    return { id, filename: match?.filename ?? '' };
  });
}

export function rememberPrintSelection(
  contextId: string,
  mode: PrintMode,
  ids: string[],
  media: MediaFile[],
  secondaryContextId?: string,
) {
  const visit = loadPrintVisit(contextId, media);
  visit.mode = mode;
  const newPicks = toPrintPicks(ids, media);
  visit.selections[mode] = newPicks;

  // Keep allPicks synchronized:
  // - Retain the chosen IDs in user's order
  // - Append any other previously chosen picks that weren't in this mode's slice
  const chosenIds = new Set(ids);
  const mergedPicks = [...newPicks];
  if (visit.allPicks) {
    for (const p of visit.allPicks) {
      if (!chosenIds.has(p.id) && !mergedPicks.some((x) => x.id === p.id)) {
        mergedPicks.push(p);
      }
    }
  }
  visit.allPicks = mergedPicks;

  // Synchronize across all 4 templates up to each limit so switching templates retains the chosen images
  const modes: PrintMode[] = ['report-5', 'report-6', 'images-only', 'images-15'];
  for (const otherMode of modes) {
    const otherLimit = getModeLimit(otherMode);
    visit.selections[otherMode] = mergedPicks.slice(0, otherLimit);
  }

  savePrintVisit(contextId, visit);
  if (secondaryContextId && secondaryContextId !== contextId) {
    savePrintVisit(secondaryContextId, visit);
  }
}

export function restorePrintSelection(
  contextId: string,
  mode: PrintMode,
  media: MediaFile[],
  limit: number,
  initialImageIds?: string[],
  secondaryContextId?: string,
): string[] {
  const visit = loadPrintVisit(contextId, media, initialImageIds);
  if (visit.mode !== mode) {
    visit.mode = mode;
    savePrintVisit(contextId, visit);
    if (secondaryContextId && secondaryContextId !== contextId) {
      savePrintVisit(secondaryContextId, visit);
    }
  }

  // 1. If explicit picks exist for this mode, resolve and return
  if (visit.selections[mode]?.length) {
    const resolved = resolvePrintPicks(visit.selections[mode], media, limit);
    if (resolved.length > 0) return resolved;
  }

  // 2. Check allPicks (accumulated from user's selections across all 4 templates)
  if (visit.allPicks?.length) {
    const resolved = resolvePrintPicks(visit.allPicks, media, limit);
    if (resolved.length > 0) {
      visit.selections[mode] = toPrintPicks(resolved, media);
      savePrintVisit(contextId, visit);
      return resolved;
    }
  }

  // 3. Check any other template's selections
  const modes: PrintMode[] = ['report-5', 'report-6', 'images-only', 'images-15'];
  for (const otherMode of modes) {
    if (otherMode !== mode && visit.selections[otherMode]?.length) {
      const resolved = resolvePrintPicks(visit.selections[otherMode], media, limit);
      if (resolved.length > 0) {
        visit.selections[mode] = toPrintPicks(resolved, media);
        savePrintVisit(contextId, visit);
        return resolved;
      }
    }
  }

  // 4. Check initialImageIds (from report.selectedImages)
  if (initialImageIds?.length) {
    const picks = idsToPicks(initialImageIds, media);
    const resolved = resolvePrintPicks(picks, media, limit);
    if (resolved.length > 0) {
      visit.selections[mode] = toPrintPicks(resolved, media);
      visit.allPicks = picks;
      savePrintVisit(contextId, visit);
      return resolved;
    }
  }

  // 5. Check secondaryContextId if provided
  if (secondaryContextId && secondaryContextId !== contextId) {
    const secVisit = loadPrintVisit(secondaryContextId, media);
    if (secVisit.selections[mode]?.length) {
      const resolved = resolvePrintPicks(secVisit.selections[mode], media, limit);
      if (resolved.length > 0) return resolved;
    }
    if (secVisit.allPicks?.length) {
      const resolved = resolvePrintPicks(secVisit.allPicks, media, limit);
      if (resolved.length > 0) return resolved;
    }
  }

  // 6. Default to first images from media gallery
  const defaultIds = media.slice(0, limit).map((item) => item.id);
  visit.selections[mode] = toPrintPicks(defaultIds, media);
  if (!visit.allPicks?.length) {
    visit.allPicks = toPrintPicks(defaultIds, media);
  }
  savePrintVisit(contextId, visit);
  return defaultIds;
}
