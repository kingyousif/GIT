import { isSameMonth, parseISO } from 'date-fns';
import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from '@/lib/constants';
import { clearEndoStorage, getMediaStorageKey, getStorage, removeStorage, setStorage, setStorageCache } from '@/lib/storage';
import { apiFetch } from '@/lib/api-client';
import {
  addMediaItemAsync,
  clearAllMediaAsync,
  deleteMediaForSessionAsync,
  deleteMediaItemAsync,
  getAllMediaAsync,
  getMediaForSessionAsync,
  importMediaAsync,
  updateMediaItemAsync,
} from '@/lib/media-db';
import {
  AppBackup,
  AppSettings,
  MediaFile,
  Patient,
  PatientRegistrationFormValues,
  PatientSessionJoined,
  ProcedureSession,
  Report,
  ReportTemplate,
  Role,
} from '@/lib/types';
import { seedAppData } from '@/lib/seed';

function uuid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getPatients() {
  return getStorage<Patient[]>(STORAGE_KEYS.patients) ?? [];
}

export function getSessions() {
  const sessions = getStorage<ProcedureSession[]>(STORAGE_KEYS.sessions) ?? [];
  const reports = getReports();
  return sessions.map((session) => ({
    ...session,
    mediaFiles: session.mediaFiles ?? [],
    report: reports.find((report) => report.sessionId === session.id),
  }));
}

export function getReports() {
  return getStorage<Report[]>(STORAGE_KEYS.reports) ?? [];
}

export function getTemplates() {
  return getStorage<ReportTemplate[]>(STORAGE_KEYS.templates) ?? DEFAULT_TEMPLATES;
}

export function getSettings() {
  const stored = getStorage<AppSettings>(STORAGE_KEYS.settings);
  if (!stored) return DEFAULT_SETTINGS;
  // Backfill procedures if missing (for existing data created before procedures became dynamic)
  if (!stored.procedures || stored.procedures.length === 0) {
    return { ...stored, procedures: DEFAULT_SETTINGS.procedures };
  }
  return stored;
}

export function getRole() {
  return getStorage<Role>(STORAGE_KEYS.role);
}

export function getMediaForSession(sessionId: string): MediaFile[] {
  // Media is loaded async via getMediaForSessionAsync(). This returns empty.
  return getStorage<MediaFile[]>(getMediaStorageKey(sessionId)) ?? [];
}

export function setRole(role: Role) {
  setStorage(STORAGE_KEYS.role, role);
}

export function generatePatientCode() {
  const year = new Date().getFullYear();
  const currentYearPatients = getPatients().filter((patient) => patient.patientCode.includes(`ENT-${year}-`));
  const maxIndex = currentYearPatients.reduce((max, patient) => {
    const segment = Number(patient.patientCode.split('-').pop() ?? 0);
    return segment > max ? segment : max;
  }, 0);
  return `ENT-${year}-${String(maxIndex + 1).padStart(4, '0')}`;
}

export function createPatientWithSession(values: PatientRegistrationFormValues) {
  const patient: Patient = {
    id: uuid(),
    patientCode: values.patientCode,
    fullName: values.fullName,
    age: values.age,
    gender: values.gender,
    phone: values.phone,
    address: values.address,
    referredBy: values.referredBy,
    createdAt: new Date().toISOString(),
  };

  const session: ProcedureSession = {
    id: uuid(),
    patientId: patient.id,
    procedureType: values.procedureType,
    doctorName: values.doctorName,
    scheduledAt: new Date(values.scheduledAt).toISOString(),
    status: 'waiting',
    indication: values.indication,
    preparation: values.preparation,
    sedation: values.sedation,
    findings: '',
    mediaFiles: [],
    createdAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.patients, [...getPatients(), patient]);
  setStorage(STORAGE_KEYS.sessions, [...getSessions().map(stripSessionRuntimeFields), session]);
  setStorage(getMediaStorageKey(session.id), []);

  return { patient, session };
}

/**
 * Create a new procedure session for an existing patient (returning patient).
 */
export function createSessionForExistingPatient(patientId: string, values: Omit<PatientRegistrationFormValues, 'patientCode' | 'fullName' | 'age' | 'gender' | 'phone' | 'address' | 'referredBy'>) {
  const patient = getPatientById(patientId);
  if (!patient) throw new Error('Patient not found.');

  const session: ProcedureSession = {
    id: uuid(),
    patientId: patient.id,
    procedureType: values.procedureType,
    doctorName: values.doctorName,
    scheduledAt: new Date(values.scheduledAt).toISOString(),
    status: 'waiting',
    indication: values.indication,
    preparation: values.preparation,
    sedation: values.sedation,
    findings: '',
    mediaFiles: [],
    createdAt: new Date().toISOString(),
  };

  setStorage(STORAGE_KEYS.sessions, [...getSessions().map(stripSessionRuntimeFields), session]);
  setStorage(getMediaStorageKey(session.id), []);

  return { patient, session };
}

export function getPatientByCode(code: string): Patient | null {
  return getPatients().find((p) => p.patientCode.toLowerCase() === code.toLowerCase()) ?? null;
}

function stripSessionRuntimeFields(session: ProcedureSession): ProcedureSession {
  return {
    ...session,
    mediaFiles: session.mediaFiles ?? [],
    report: session.report,
  };
}

export async function updatePatient(patientId: string, updates: Partial<Patient>) {
  const next = getPatients().map((patient) => (patient.id === patientId ? { ...patient, ...updates } : patient));
  await setStorage(STORAGE_KEYS.patients, next);
  return next.find((patient) => patient.id === patientId) ?? null;
}

export async function updateSession(sessionId: string, updates: Partial<ProcedureSession>) {
  const next = getSessions().map((session) =>
    session.id === sessionId ? { ...session, ...updates, mediaFiles: updates.mediaFiles ?? session.mediaFiles } : stripSessionRuntimeFields(session),
  );
  await setStorage(STORAGE_KEYS.sessions, next.map(stripSessionRuntimeFields));
  return next.find((session) => session.id === sessionId) ?? null;
}

export function getPatientById(patientId: string) {
  return getPatients().find((patient) => patient.id === patientId) ?? null;
}

export function getSessionById(sessionId: string) {
  return getSessions().find((session) => session.id === sessionId) ?? null;
}

export function getReportBySessionId(sessionId: string) {
  return getReports().find((report) => report.sessionId === sessionId) ?? null;
}

export function getSessionsForPatient(patientId: string) {
  return getSessions()
    .filter((session) => session.patientId === patientId)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export function getJoinedSessions(): PatientSessionJoined[] {
  const patients = getPatients();
  return getSessions()
    .map((session) => {
      const patient = patients.find((item) => item.id === session.patientId);
      if (!patient) return null;
      return {
        patient,
        session: session as ProcedureSession,
        report: getReportBySessionId(session.id) ?? undefined,
        media: [] as MediaFile[], // Media is loaded async when needed
      } as PatientSessionJoined;
    })
    .filter((item): item is PatientSessionJoined => Boolean(item));
}

export function getJoinedSessionById(sessionId: string) {
  return getJoinedSessions().find((item) => item.session.id === sessionId) ?? null;
}

export function saveMedia(sessionId: string, media: MediaFile[]) {
  // Only update the session's mediaFiles reference (without dataUrl to save space).
  updateSession(sessionId, { mediaFiles: media.map((m) => ({ ...m, dataUrl: '' })) });
}

export function addMediaItem(sessionId: string, media: Omit<MediaFile, 'id' | 'capturedAt' | 'sessionId'> & Partial<Pick<MediaFile, 'id' | 'capturedAt'>>) {
  const nextItem: MediaFile = {
    id: media.id ?? uuid(),
    sessionId,
    capturedAt: media.capturedAt ?? new Date().toISOString(),
    label: media.label,
    annotations: media.annotations,
    dataUrl: media.dataUrl,
    filename: media.filename,
    source: media.source,
    type: media.type,
  };

  // Save to server via addMediaItemAsync
  addMediaItemAsync(nextItem).catch(console.error);
  return nextItem;
}

export function updateMediaItem(sessionId: string, mediaId: string, updates: Partial<MediaFile>) {
  // Delegate to server file storage
  updateMediaItemAsync(mediaId, { ...updates, sessionId }).catch(console.error);
}

export function deleteMediaItem(sessionId: string, mediaId: string) {
  // Delegate to server file storage
  deleteMediaItemAsync(mediaId, sessionId).catch(console.error);
}

export function getReportsForSession(sessionId: string): Report[] {
  return getReports().filter((report) => report.sessionId === sessionId);
}

export async function deleteReport(reportId: string): Promise<void> {
  const response = await apiFetch(`/api/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Unable to delete report (${response.status}).`);
  }

  setStorageCache(
    STORAGE_KEYS.reports,
    getReports().filter((report) => report.id !== reportId),
  );
}

export async function saveReport(reportInput: Omit<Report, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Report, 'id' | 'createdAt' | 'updatedAt'>>) {
  const reports = getReports();
  const existing = reportInput.id ? reports.find((report) => report.id === reportInput.id) : null;
  const now = new Date().toISOString();
  const report: Report = {
    ...reportInput,
    id: existing?.id ?? reportInput.id ?? uuid(),
    createdAt: existing?.createdAt ?? reportInput.createdAt ?? now,
    updatedAt: now,
  };
  const isUpdate = Boolean(reportInput.id);
  const response = await apiFetch(
    isUpdate ? `/api/reports/${encodeURIComponent(report.id)}` : '/api/reports',
    {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Unable to save report (${response.status}).`);
  }

  const saved = await response.json() as Report;
  const currentReports = getReports();
  const found = currentReports.some((item) => item.id === saved.id);
  setStorageCache(
    STORAGE_KEYS.reports,
    found
      ? currentReports.map((item) => (item.id === saved.id ? saved : item))
      : [...currentReports, saved],
  );

  const session = getSessionById(saved.sessionId);
  if (session) {
    try {
      await updateSession(saved.sessionId, {
        findings: saved.sections.find((section) => section.title.toLowerCase().includes('finding'))?.content ?? session.findings,
        status: saved.status === 'final' ? 'completed' : session.status,
        completedAt: saved.status === 'final' ? new Date().toISOString() : session.completedAt,
      });
    } catch (error) {
      // The report is already safely persisted. Do not turn a secondary
      // session-summary failure into a duplicate report on retry.
      console.error('Report saved, but the session summary could not be updated:', error);
    }
  }

  return saved;
}

export function saveTemplates(templates: ReportTemplate[]) {
  setStorage(STORAGE_KEYS.templates, templates);
}

export function saveSettings(settings: AppSettings) {
  setStorage(STORAGE_KEYS.settings, settings);
}

export function getDashboardStats() {
  const joined = getJoinedSessions();
  const now = new Date();

  return {
    todayTotalPatients: joined.filter((item) => {
      try {
        return new Date(item.session.scheduledAt).toDateString() === now.toDateString();
      } catch {
        return false;
      }
    }).length,
    completedToday: joined.filter((item) => {
      try {
        return item.session.status === 'completed' && new Date(item.session.scheduledAt).toDateString() === now.toDateString();
      } catch {
        return false;
      }
    }).length,
    waitingNow: joined.filter((item) => item.session.status === 'waiting').length,
    monthTotal: joined.filter((item) => {
      try {
        return isSameMonth(parseISO(item.session.scheduledAt), now);
      } catch {
        return false;
      }
    }).length,
  };
}

export async function exportAllData(): Promise<AppBackup> {
  const sessions = getSessions();
  const media = await getAllMediaAsync();
  const { getUsers } = await import('@/lib/auth');
  return {
    patients: getPatients(),
    sessions,
    reports: getReports(),
    templates: getTemplates(),
    settings: getSettings(),
    role: null,
    media,
    users: await getUsers(),
  };
}

export async function importAllData(backup: AppBackup) {
  clearEndoStorage();
  await clearAllMediaAsync();
  setStorage(STORAGE_KEYS.settings, backup.settings);
  setStorage(STORAGE_KEYS.templates, backup.templates);
  setStorage(STORAGE_KEYS.patients, backup.patients);
  setStorage(STORAGE_KEYS.sessions, backup.sessions.map(stripSessionRuntimeFields));
  setStorage(STORAGE_KEYS.reports, backup.reports);
  if (backup.users) setStorage('endo_users', backup.users);
  if (backup.media) {
    await importMediaAsync(backup.media);
  }
  setStorage(STORAGE_KEYS.seeded, true);
}

export async function resetAppData() {
  clearEndoStorage();
  await clearAllMediaAsync();
  seedAppData(true, false);
}

export function deleteTemplate(templateId: string) {
  const next = getTemplates().filter((template) => template.id !== templateId);
  saveTemplates(next);
}

export function upsertTemplate(template: ReportTemplate) {
  const templates = getTemplates();
  const exists = templates.some((item) => item.id === template.id);
  const next = exists ? templates.map((item) => (item.id === template.id ? template : item)) : [...templates, template];
  saveTemplates(next);
}

export async function removeSession(sessionId: string) {
  const nextSessions = getSessions().filter((session) => session.id !== sessionId);
  const nextReports = getReports().filter((report) => report.sessionId !== sessionId);
  setStorage(STORAGE_KEYS.sessions, nextSessions.map(stripSessionRuntimeFields));
  setStorage(STORAGE_KEYS.reports, nextReports);
  removeStorage(getMediaStorageKey(sessionId));
  await deleteMediaForSessionAsync(sessionId);
}
