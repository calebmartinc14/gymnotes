import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackPage } from './Feedback'
import { I18nProvider } from '../lib/i18n'

const { fetchMock, submitMock, updateMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  submitMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('../lib/feedback', () => ({
  fetchFeedback: fetchMock,
  submitFeedback: submitMock,
  updateFeedbackStatus: updateMock,
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  fetchMock.mockReset()
  submitMock.mockReset()
  updateMock.mockReset()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('FeedbackPage access', () => {
  it('lets a signed-in user submit private feedback without fetching the inbox', () => {
    act(() => {
      root.render(
        <I18nProvider initialLocale="en">
          <FeedbackPage
            userId="user-a"
            isAdmin={false}
            authAvailable
            onRequestAuth={() => {}}
          />
        </I18nProvider>,
      )
    })

    expect(host.querySelector('textarea')).not.toBeNull()
    expect(host.querySelector('.feedback-admin')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads the inbox only for a verified admin', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'feedback-1',
        user_id: 'user-b',
        category: 'idea',
        message: 'Add a way to duplicate workouts.',
        status: 'new',
        created_at: '2026-11-05T12:00:00.000Z',
      },
    ])

    await act(async () => {
      root.render(
        <I18nProvider initialLocale="en">
          <FeedbackPage
            userId="admin-user"
            isAdmin
            authAvailable
            onRequestAuth={() => {}}
          />
        </I18nProvider>,
      )
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(host.querySelector('.feedback-admin')).not.toBeNull()
    expect(host.textContent).toContain('Add a way to duplicate workouts.')
  })
})
