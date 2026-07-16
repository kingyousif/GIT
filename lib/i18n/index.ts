import en from './en';
import ckb from './ckb';
import ar from './ar';
import { Locale } from './types';

export type { Locale } from './types';
export { LOCALE_META } from './types';

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type Translations = DeepString<typeof en>;

const translations: Record<Locale, Translations> = { en, ckb, ar };

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}
