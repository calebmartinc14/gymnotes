/* eslint-disable react-refresh/only-export-components -- this module intentionally
   exports the i18n provider together with its hook and pure label helpers. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { en } from './locales/en'
import type { TranslationKey } from './locales/en'
import { es } from './locales/es'
import { setCalcLocale } from './calc'

export type Locale = 'en' | 'es'

export const LOCALES: Locale[] = ['en', 'es']

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

/** BCP 47 tag used for Intl date/number formatting. */
const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
}

const LOCALE_STORAGE_KEY = 'gymnotes:locale'

const DICTS: Record<Locale, Record<string, string>> = {
  en,
  es,
}

export type TranslateVars = Record<string, string | number>
export type TFunction = (key: string, vars?: TranslateVars) => string

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  )
}

/**
 * Look up a key in the active locale, falling back to English and finally to
 * the key itself. When `vars.count` is present, `key_one` / `key_other` win.
 */
export function translate(locale: Locale, key: string, vars?: TranslateVars): string {
  const dict = DICTS[locale]
  let template = dict[key]
  if (vars && typeof vars.count === 'number') {
    template = dict[`${key}_${vars.count === 1 ? 'one' : 'other'}`] ?? template
  }
  if (template === undefined) template = en[key as TranslationKey]
  if (template === undefined) return key
  return interpolate(template, vars)
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es'
}

/** Stored choice first, then the browser language, then English. */
export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // ignore private-mode / quota errors
  }
  const nav = typeof navigator !== 'undefined' ? (navigator.language ?? '') : ''
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export interface I18nValue {
  locale: Locale
  intlLocale: string
  setLocale: (locale: Locale) => void
  t: TFunction
}

const defaultTranslate: TFunction = (key, vars) => translate('en', key, vars)

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  intlLocale: INTL_LOCALE.en,
  setLocale: () => {},
  t: defaultTranslate,
})

export { I18nContext }

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = initialLocale ?? detectLocale()
    // Apply before the first paint so dates and numbers render in the right locale.
    setCalcLocale(INTL_LOCALE[initial])
    return initial
  })
  const intlLocale = INTL_LOCALE[locale]

  useEffect(() => {
    setCalcLocale(intlLocale)
    if (typeof document !== 'undefined') document.documentElement.lang = locale
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // ignore private-mode / quota errors
    }
  }, [locale, intlLocale])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])
  const t = useCallback<TFunction>((key, vars) => translate(locale, key, vars), [locale])

  const value = useMemo<I18nValue>(
    () => ({ locale, intlLocale, setLocale, t }),
    [locale, intlLocale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

// ---------------------------------------------------------------------------
// Domain label helpers — keep stored data canonical (English) and translate it
// for display only.
// ---------------------------------------------------------------------------

export function exerciseLabel(
  exercise: { id: string; name: string; custom?: boolean },
  t: TFunction,
): string {
  if (exercise.custom) return exercise.name
  const key = `exercise.${exercise.id}`
  const translated = t(key)
  return translated === key ? exercise.name : translated
}

export function muscleLabel(group: string, t: TFunction): string {
  const key = `muscle.${group}`
  const translated = t(key)
  return translated === key ? group : translated
}

export function levelLabel(level: string, t: TFunction): string {
  const key = `level.${level}`
  const translated = t(key)
  return translated === key ? level : translated
}

const BMI_KEYS: Record<string, string> = {
  Underweight: 'bmi.underweight',
  'Healthy range': 'bmi.healthy',
  'Overweight range': 'bmi.overweight',
  'Obese range': 'bmi.obese',
}

export function bmiCategoryLabel(category: string, t: TFunction): string {
  const key = BMI_KEYS[category]
  return key ? t(key) : category
}
