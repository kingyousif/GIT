export type Locale = 'en' | 'ckb' | 'ar';

export type Direction = 'ltr' | 'rtl';

export interface LocaleMeta {
  label: string;
  dir: Direction;
  flag: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { label: 'English', dir: 'ltr', flag: '🇬🇧' },
  ckb: { label: 'کوردی', dir: 'rtl', flag: '🇮🇶' },
  ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
};

export type TranslationKeys = typeof import('./en').default;
