import { format, isSameDay, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProcedureType } from '@/lib/types';
import { PROCEDURE_LABELS, STATUS_META } from '@/lib/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string, pattern = 'PPP') {
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export function formatDateTime(value: string, pattern = 'PPP p') {
  return formatDate(value, pattern);
}

export function isTodayIso(value: string) {
  try {
    return isSameDay(parseISO(value), new Date());
  } catch {
    return false;
  }
}

export function getProcedureLabel(type: ProcedureType) {
  // Try saved settings first (dynamic procedures), fall back to defaults, then to id
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('endo_settings');
      if (stored) {
        const parsed = JSON.parse(stored) as { procedures?: { id: string; label: string }[] };
        const found = parsed.procedures?.find((p) => p.id === type);
        if (found) return found.label;
      }
    } catch {
      // ignore
    }
  }
  return PROCEDURE_LABELS[type] ?? type;
}

export function getStatusMeta(status: keyof typeof STATUS_META) {
  return STATUS_META[status];
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function generateSvgPlaceholder(label: string, accent = '#0F766E') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#E2E8F0" />
      <rect x="40" y="40" width="560" height="280" rx="24" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="4" stroke-dasharray="12 12" />
      <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-size="34" font-family="Arial, sans-serif" fill="#0F172A">${label}</text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#334155">Endoscopy Unit Demo Image</text>
    </svg>`;
  return `data:image/svg+xml;base64,${typeof window === 'undefined' ? Buffer.from(svg).toString('base64') : btoa(svg)}`;
}

export function createTextReportCopy(input: {
  hospitalName: string;
  departmentName: string;
  patientName: string;
  patientCode: string;
  procedureLabel: string;
  doctorName: string;
  dateTime: string;
  sections: { title: string; content: string }[];
  diagnosis: string[];
  recommendations: string[];
  followUp?: string;
}) {
  const lines = [
    input.hospitalName,
    input.departmentName,
    'ENDOSCOPY REPORT',
    `Patient: ${input.patientName} (${input.patientCode})`,
    `Procedure: ${input.procedureLabel}`,
    `Doctor: ${input.doctorName}`,
    `Date: ${input.dateTime}`,
    '',
  ];

  input.sections.forEach((section) => {
    lines.push(`${section.title.toUpperCase()}:`);
    lines.push(section.content);
    lines.push('');
  });

  if (input.diagnosis.length) {
    lines.push('DIAGNOSIS:');
    input.diagnosis.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push('');
  }

  if (input.recommendations.length) {
    lines.push('RECOMMENDATIONS:');
    input.recommendations.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push('');
  }

  if (input.followUp) {
    lines.push('FOLLOW-UP:');
    lines.push(input.followUp);
  }

  return lines.join('\n');
}

export function toDatetimeLocalValue(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date;
  const offset = value.getTimezoneOffset();
  const adjusted = new Date(value.getTime() - offset * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
