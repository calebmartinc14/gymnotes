import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '../lib/feedback'
import { fetchFeedback, submitFeedback, updateFeedbackStatus } from '../lib/feedback'
import { useI18n } from '../lib/i18n'
import { MessageIcon } from './Icons'
import { PageHead } from './ui'

interface FeedbackPageProps {
  userId: string | null
  isAdmin: boolean
  authAvailable: boolean
  onRequestAuth: () => void
}

const STATUSES: FeedbackStatus[] = ['new', 'reviewing', 'resolved']

export function FeedbackPage({
  userId,
  isAdmin,
  authAvailable,
  onRequestAuth,
}: FeedbackPageProps) {
  const { t, intlLocale } = useI18n()
  const [category, setCategory] = useState<FeedbackCategory>('idea')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    void fetchFeedback()
      .then((result) => {
        if (active) setItems(result)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [isAdmin])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!userId || message.trim().length < 10) return
    setBusy(true)
    setNotice('')
    try {
      await submitFeedback(userId, category, message)
      setMessage('')
      setNotice(t('feedback.sent'))
    } catch {
      setNotice(t('feedback.submitError'))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(item: FeedbackItem, status: FeedbackStatus) {
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)))
    try {
      await updateFeedbackStatus(item.id, status)
    } catch {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, status: item.status } : entry)),
      )
      setLoadFailed(true)
    }
  }

  return (
    <div className="page feedback-page">
      <PageHead
        kicker={t('feedback.kicker')}
        title={t('feedback.title')}
        subtitle={t('feedback.subtitle')}
      />

      {!userId ? (
        <section className="card feedback-signin">
          <MessageIcon size={24} />
          <div>
            <h2>{t('feedback.signInTitle')}</h2>
            <p>{authAvailable ? t('feedback.signInHint') : t('feedback.unavailable')}</p>
          </div>
          {authAvailable && (
            <button type="button" className="btn btn-primary" onClick={onRequestAuth}>
              {t('profile.signIn')}
            </button>
          )}
        </section>
      ) : (
        <section className="card feedback-compose">
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('feedback.privateKicker')}</span>
              <h2>{t('feedback.formTitle')}</h2>
            </div>
          </div>
          <p className="feedback-privacy-note">{t('feedback.privacyNote')}</p>
          <form onSubmit={send}>
            <label className="field">
              <span>{t('feedback.categoryLabel')}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
              >
                <option value="idea">{t('feedback.categoryIdea')}</option>
                <option value="bug">{t('feedback.categoryBug')}</option>
                <option value="other">{t('feedback.categoryOther')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('feedback.messageLabel')}</span>
              <textarea
                rows={5}
                minLength={10}
                maxLength={2000}
                required
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('feedback.messagePlaceholder')}
              />
            </label>
            <div className="feedback-form-foot">
              <span>{message.length}/2000</span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || message.trim().length < 10}
              >
                {busy ? t('feedback.sending') : t('feedback.send')}
              </button>
            </div>
            {notice && <p className="feedback-notice" role="status">{notice}</p>}
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="feedback-admin">
          <div className="feedback-admin-head">
            <div>
              <span className="card-kicker">{t('feedback.adminKicker')}</span>
              <h2>{t('feedback.adminTitle')}</h2>
            </div>
            <span className="count-badge">{items.length}</span>
          </div>
          {loadFailed && <p className="feedback-error" role="alert">{t('feedback.adminError')}</p>}
          {items.length === 0 ? (
            <div className="card feedback-empty">{t('feedback.empty')}</div>
          ) : (
            <div className="feedback-list">
              {items.map((item) => (
                <article className="card feedback-item" key={item.id}>
                  <div className="feedback-item-head">
                    <div className="feedback-meta">
                      <span className={`feedback-category feedback-category-${item.category}`}>
                        {t(`feedback.category${item.category[0].toUpperCase()}${item.category.slice(1)}`)}
                      </span>
                      <span>{new Date(item.created_at).toLocaleString(intlLocale)}</span>
                      <code title={item.user_id}>{item.user_id.slice(0, 8)}</code>
                    </div>
                    <label className="feedback-status-field">
                      <span className="sr-only">{t('feedback.statusLabel')}</span>
                      <select
                        value={item.status}
                        onChange={(event) => void changeStatus(item, event.target.value as FeedbackStatus)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`feedback.status${status[0].toUpperCase()}${status.slice(1)}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="feedback-message">{item.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
