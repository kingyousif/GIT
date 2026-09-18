import { differenceInYears, format, isValid, parseISO, subYears } from 'date-fns';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayIsoDate(at = new Date()) {
  return format(at, 'yyyy-MM-dd');
}

export function minBirthIsoDate(at = new Date()) {
  return format(subYears(at, 120), 'yyyy-MM-dd');
}

export function parseIsoDate(value?: string | null) {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function ageFromDateOfBirth(dateOfBirth?: string | null, at = new Date()) {
  const date = parseIsoDate(dateOfBirth);
  if (!date || date > at) return null;
  const age = differenceInYears(at, date);
  if (age < 0 || age > 120) return null;
  return age;
}

export function dateOfBirthFromAge(age: number, existingDob?: string | null, at = new Date()) {
  if (!Number.isFinite(age) || age < 0 || age > 120) return '';

  const existing = parseIsoDate(existingDob);
  if (existing) {
    const candidates = [
      new Date(at.getFullYear() - age, existing.getMonth(), existing.getDate()),
      new Date(at.getFullYear() - age - 1, existing.getMonth(), existing.getDate()),
      new Date(at.getFullYear() - age + 1, existing.getMonth(), existing.getDate()),
    ];
    const match = candidates.find((candidate) => isValid(candidate) && differenceInYears(at, candidate) === age);
    if (match) return format(match, 'yyyy-MM-dd');
  }

  return format(subYears(at, age), 'yyyy-MM-dd');
}

export function formatDateOfBirth(dateOfBirth?: string | null, pattern = 'dd/MM/yyyy') {
  const date = parseIsoDate(dateOfBirth);
  if (!date) return '';
  try {
    return format(date, pattern);
  } catch {
    return dateOfBirth ?? '';
  }
}
