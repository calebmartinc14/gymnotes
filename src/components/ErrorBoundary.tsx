import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { I18nContext } from '../lib/i18n'
import type { I18nValue } from '../lib/i18n'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render errors so a single bad state can't leave the user with a blank page.
 * Local data is never destroyed — the user can export it or reset from here.
 */
export class ErrorBoundary extends Component<Props, State> {
  static contextType = I18nContext
  declare context: I18nValue

  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GymNotes crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { t } = this.context

    return (
      <div className="error-screen">
        <div className="error-card">
          <h1>{t('error.title')}</h1>
          <p>{t('error.text')}</p>
          <pre className="error-detail">{error.message}</pre>
          <div className="error-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              {t('action.reload')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => this.setState({ error: null })}
            >
              {t('action.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
