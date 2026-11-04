import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './Calendar'
import { emptyState } from '../lib/storage'
import { I18nProvider } from '../lib/i18n'
import { todayISO } from '../lib/calc'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
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

describe('CalendarPage', () => {
  it('counts a multi-exercise workout session once', () => {
    const state = emptyState()
    state.workouts = [
      {
        id: 'workout-a',
        date: todayISO(),
        exerciseId: 'bench-press',
        sets: [{ reps: 5, weight: 80 }],
        bodyweightKg: null,
        createdAt: 1,
        sessionId: 'session-a',
      },
      {
        id: 'workout-b',
        date: todayISO(),
        exerciseId: 'back-squat',
        sets: [{ reps: 5, weight: 100 }],
        bodyweightKg: null,
        createdAt: 2,
        sessionId: 'session-a',
      },
    ]

    act(() => {
      root.render(
        <I18nProvider initialLocale="en">
          <CalendarPage state={state} onLog={() => {}} onProgress={() => {}} />
        </I18nProvider>,
      )
    })

    expect(host.querySelector('.calendar-day-card .count-badge')?.textContent).toBe('1')
    expect(host.querySelector('.cal-summary strong')?.textContent).toBe('1')
  })

  it('starts logging for the date selected in the calendar', () => {
    const onLog = vi.fn()
    const selectedDate = `${todayISO().slice(0, 7)}-15`

    act(() => {
      root.render(
        <I18nProvider initialLocale="en">
          <CalendarPage state={emptyState()} onLog={onLog} onProgress={() => {}} />
        </I18nProvider>,
      )
    })

    const selectedDay = [...host.querySelectorAll<HTMLButtonElement>('.cal-cell:not(.is-empty)')].find(
      (button) => button.querySelector('.cal-daynum')?.textContent === '15',
    )
    expect(selectedDay).toBeDefined()
    act(() => selectedDay?.click())

    const logButtons = [...host.querySelectorAll<HTMLButtonElement>('button')].filter((button) =>
      button.textContent?.includes('Log a workout'),
    )
    const logButton = logButtons.at(-1)
    expect(logButton).toBeDefined()
    act(() => logButton?.click())

    expect(onLog).toHaveBeenCalledWith(selectedDate)
  })
})
