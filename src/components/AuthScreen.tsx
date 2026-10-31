import { useState } from 'react'
import type { FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { DumbbellIcon, LockIcon, MailIcon } from './Icons'
import { LanguageSwitch } from './LanguageSwitch'

type Mode = 'signin' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthScreen() {
  const { t } = useI18n()
  const { signIn, signUp, continueLocal } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('auth.errEmail'))
      return
    }
    if (password.length < 6) {
      setError(t('auth.errPassword'))
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        const result = await signIn(trimmed, password)
        if (result.error) setError(t(result.error))
      } else {
        const result = await signUp(trimmed, password)
        if (result.error) {
          setError(t(result.error))
        } else if (result.needsConfirmation) {
          setNotice(t('auth.checkEmail'))
          setMode('signin')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-topbar">
        <LanguageSwitch />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <DumbbellIcon size={22} />
          </span>
          <span className="brand-word">
            Gym<span>Notes</span>
          </span>
        </div>

        <h1 className="auth-title">{t('auth.welcomeTitle')}</h1>
        <p className="auth-sub">{t('auth.welcomeText')}</p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => switchMode('signin')}
          >
            {t('auth.signIn')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            {t('auth.signUp')}
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>{t('auth.email')}</span>
            <div className="auth-input">
              <MailIcon size={16} />
              <input
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>

          <label className="field">
            <span>{t('auth.password')}</span>
            <div className="auth-input">
              <LockIcon size={16} />
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="text-btn" onClick={continueLocal}>
            {t('auth.continueLocal')}
          </button>
          <p className="fineprint">{t('auth.continueLocalHint')}</p>
        </div>
      </div>
    </div>
  )
}
