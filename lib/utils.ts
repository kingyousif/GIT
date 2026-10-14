import { format, isSameDay, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AppSettings, ProcedureType } from '@/lib/types';
import { DIAGNOSIS_SUGGESTIONS, PROCEDURE_LABELS, STATUS_META, STORAGE_KEYS } from '@/lib/constants';
import { getStorage } from '@/lib/storage';

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

/**
 * Normalizes a procedure type string or slug.
 * Equates medical synonyms and common variations (OGD, EGD, Upper Endoscopy, Gastroscopy).
 */
export function normalizeProcedureType(type?: string): string {
  if (!type) return '';
  const trimmed = String(type).trim().toLowerCase().replace(/[\s_]+/g, '-');

  // Upper GI endoscopy synonyms
  if (
    trimmed === 'ogd' ||
    trimmed === 'egd' ||
    trimmed === 'upper-endoscopy' ||
    trimmed === 'gastroscopy' ||
    trimmed === 'upper-gi-endoscopy' ||
    trimmed.includes('ogd') ||
    trimmed.includes('egd') ||
    trimmed.includes('upper-endoscopy')
  ) {
    return 'upper-endoscopy';
  }

  // Colonoscopy synonyms
  if (trimmed === 'colon' || trimmed === 'colonoscopy' || trimmed.includes('colonoscopy')) {
    return 'colonoscopy';
  }

  // Sigmoidoscopy synonyms
  if (trimmed === 'sigmoidoscopy' || trimmed === 'flexible-sigmoidoscopy' || trimmed.includes('sigmoidoscopy')) {
    return 'sigmoidoscopy';
  }

  // ERCP synonyms
  if (trimmed === 'ercp' || trimmed.includes('ercp')) {
    return 'ercp';
  }

  // Bronchoscopy synonyms
  if (trimmed === 'bronchoscopy' || trimmed === 'broncho' || trimmed.includes('bronchoscopy')) {
    return 'bronchoscopy';
  }

  // Capsule endoscopy synonyms
  if (trimmed === 'capsule' || trimmed === 'capsule-endoscopy' || trimmed.includes('capsule')) {
    return 'capsule-endoscopy';
  }

  return trimmed;
}

/**
 * Compares two procedure types/IDs/labels for equivalence.
 * Matches case-insensitively, slug-wise, synonym-wise (e.g. OGD == Upper-Endoscopy == EGD),
 * and checks against procedure definitions in settings if available.
 */
export function isSameProcedureType(
  a?: string,
  b?: string,
  proceduresList?: { id: string; label?: string }[]
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.toLowerCase() === b.toLowerCase()) return true;

  const normA = normalizeProcedureType(a);
  const normB = normalizeProcedureType(b);
  if (normA && normB && normA === normB) return true;

  const list =
    proceduresList ??
    (typeof window !== 'undefined'
      ? getStorage<AppSettings>(STORAGE_KEYS.settings)?.procedures
      : undefined);

  if (list && list.length > 0) {
    const matchA = list.find((p) => p.id === a || p.label === a || isSameProcedureType(p.id, a) || isSameProcedureType(p.label, a));
    const matchB = list.find((p) => p.id === b || p.label === b || isSameProcedureType(p.id, b) || isSameProcedureType(p.label, b));
    if (matchA && matchB && matchA.id === matchB.id) return true;
  }

  return false;
}

export function getProcedureLabel(type: ProcedureType) {
  if (!type) return '';
  if (typeof window !== 'undefined') {
    const settings = getStorage<AppSettings>(STORAGE_KEYS.settings);
    const found = settings?.procedures?.find(
      (p) => isSameProcedureType(p.id, type) || isSameProcedureType(p.label, type)
    );
    if (found?.label) return found.label;
  }
  for (const [key, label] of Object.entries(PROCEDURE_LABELS)) {
    if (isSameProcedureType(key, type)) return label;
  }
  return PROCEDURE_LABELS[type] ?? type.replace(/-/g, ' ');
}

export function getDiagnosisSuggestions(type?: string): string[] {
  if (!type) return [];
  for (const [key, list] of Object.entries(DIAGNOSIS_SUGGESTIONS)) {
    if (isSameProcedureType(key, type)) return list;
  }
  return [];
}

export function formatSedation(sedation?: string): string {
  if (!sedation) return 'None';
  const trimmed = sedation.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'none') return 'None';
  if (lower === 'conscious') return 'Conscious Sedation';
  if (lower === 'local') return 'Local Anesthesia';
  if (lower === 'general') return 'General Anesthesia';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatRecommendationHtml(
  text: string,
  options: { bold?: boolean; color?: string; bgColor?: string; fontSize?: string }
): string {
  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  if (!cleanText) return '';
  const bold = options.bold ?? false;
  const color =
    options.color &&
    options.color !== '#0f172a' &&
    options.color !== 'inherit' &&
    options.color !== 'default'
      ? options.color
      : undefined;
  const bgColor =
    options.bgColor &&
    options.bgColor !== 'transparent' &&
    options.bgColor !== 'none' &&
    options.bgColor !== ''
      ? options.bgColor
      : undefined;
  const fontSize =
    options.fontSize &&
    options.fontSize !== '11.5px' &&
    options.fontSize !== '11px' &&
    options.fontSize !== 'inherit' &&
    options.fontSize !== 'normal' &&
    options.fontSize !== 'default'
      ? options.fontSize
      : undefined;

  if (!bold && !color && !bgColor && !fontSize) {
    return cleanText;
  }

  const styles: string[] = [];
  if (fontSize) styles.push(`font-size: ${fontSize}`);
  if (bold) styles.push('font-weight: 700');
  if (color) styles.push(`color: ${color}`);
  if (bgColor) {
    styles.push(`background-color: ${bgColor}`);
    styles.push('padding: 2px 6px');
    styles.push('border-radius: 4px');
  }

  return `<span style="${styles.join('; ')}">${cleanText}</span>`;
}

export function parseRecommendation(item: string): {
  text: string;
  bold: boolean;
  color: string;
  bgColor: string;
  fontSize: string;
} {
  if (!item.includes('<') && !item.includes('>')) {
    return { text: item, bold: false, color: '#0f172a', bgColor: 'transparent', fontSize: '11.5px' };
  }
  const isBold =
    /font-weight:\s*(bold|700|800|900)/i.test(item) || /<strong|<b\b/i.test(item);
  const colorMatch = item.match(/color:\s*([^;"]+)/i);
  const bgColorMatch = item.match(/background-color:\s*([^;"]+)/i);
  const fontSizeMatch = item.match(/font-size:\s*([^;"]+)/i);
  const cleanText = item.replace(/<[^>]*>/g, '').trim();
  return {
    text: cleanText,
    bold: isBold,
    color: colorMatch ? colorMatch[1].trim() : '#0f172a',
    bgColor: bgColorMatch ? bgColorMatch[1].trim() : 'transparent',
    fontSize: fontSizeMatch ? fontSizeMatch[1].trim() : '11.5px',
  };
}

export function formatAge(age: number, yearsLabel: string) {
  return `${age} ${yearsLabel}`;
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
    const text = (section.content || '').replace(/<[^>]*>/g, '').trim();
    if (!text) return;
    lines.push(`${section.title.toUpperCase()}:`);
    lines.push(text);
    lines.push('');
  });

  const validDiagnosis = input.diagnosis.filter((item) => item && item.trim().length > 0);
  if (validDiagnosis.length) {
    lines.push('DIAGNOSIS:');
    validDiagnosis.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
    lines.push('');
  }

  const validRecs = input.recommendations.filter((item) => item && item.trim().length > 0);
  if (validRecs.length) {
    lines.push('RECOMMENDATIONS:');
    validRecs.forEach((item, index) => {
      const plain = item.replace(/<[^>]*>/g, '').trim();
      if (plain) lines.push(`${index + 1}. ${plain}`);
    });
    lines.push('');
  }

  if (input.followUp) {
    const followUpText = input.followUp.replace(/<[^>]*>/g, '').trim();
    if (followUpText) {
      lines.push('FOLLOW-UP:');
      lines.push(followUpText);
    }
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
