import { describe, expect, it } from 'vitest'
import type { Workout } from '../types'
import { countSessions, groupSessions, sessionFromWorkout, sessionWorkouts } from './sessions'

function workout(overrides: Partial<Workout> & Pick<Workout, 'id'>): Workout {
  return {
    date: '2026-01-01',
    exerciseId: 'bench-press',
    sets: [{ reps: 5, weight: 100 }],
    bodyweightKg: 80,
    createdAt: 1,
    ...overrides,
  }
}

describe('session grouping', () => {
  it('treats legacy rows as individual sessions', () => {
    const sessions = groupSessions([
      workout({ id: 'a', exerciseId: 'bench-press' }),
      workout({ id: 'b', exerciseId: 'back-squat', createdAt: 2 }),
    ])

    expect(sessions).toHaveLength(2)
    expect(sessions.every((session) => session.sessionId === null)).toBe(true)
  })

  it('groups rows with the same session id and orders them', () => {
    const sessions = groupSessions([
      workout({ id: 'b', sessionId: 's1', position: 1, exerciseId: 'back-squat' }),
      workout({ id: 'a', sessionId: 's1', position: 0, exerciseId: 'bench-press' }),
      workout({ id: 'c', exerciseId: 'deadlift' }),
    ])

    expect(sessions).toHaveLength(2)
    const session = sessions.find((item) => item.sessionId === 's1')
    expect(session?.workouts.map((item) => item.id)).toEqual(['a', 'b'])
    expect(session?.name).toBe('')
  })

  it('sorts sessions by most recent date', () => {
    const sessions = groupSessions([
      workout({ id: 'old', date: '2025-12-01' }),
      workout({ id: 'new', date: '2026-01-02' }),
    ])
    expect(sessions.map((session) => session.date)).toEqual(['2026-01-02', '2025-12-01'])
  })

  it('finds the session for a workout and counts sessions', () => {
    const rows = [
      workout({ id: 'a', sessionId: 's1', position: 0 }),
      workout({ id: 'b', sessionId: 's1', position: 1 }),
      workout({ id: 'c' }),
    ]

    expect(sessionWorkouts(rows, rows[1]).map((item) => item.id)).toEqual(['a', 'b'])
    expect(sessionFromWorkout(rows, rows[1])?.sessionId).toBe('s1')
    expect(countSessions(rows)).toBe(2)
  })

  it('counts a multi-exercise session once while preserving legacy rows', () => {
    const rows = [
      workout({ id: 'a', sessionId: 'new-session', position: 0 }),
      workout({ id: 'b', sessionId: 'new-session', position: 1, exerciseId: 'back-squat' }),
      workout({ id: 'legacy-a', exerciseId: 'deadlift' }),
      workout({ id: 'legacy-b', exerciseId: 'overhead-press' }),
    ]

    expect(countSessions(rows)).toBe(3)
  })
})
