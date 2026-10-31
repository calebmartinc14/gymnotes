import { LOCALES, useI18n } from '../lib/i18n'

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('app.language')}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={locale === code ? 'active' : ''}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          lang={code}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
