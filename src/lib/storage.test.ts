import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearLocalAccountCache,
  LOCAL_OWNER_KEY,
  normalizeState,
  STORAGE_KEY,
  validateImport,
  STORAGE_VERSION,
} from './storage'

beforeEach(() => localStorage.clear())

describe('account cache boundary', () => {
  it('clears cached account data and owner while preserving queued sync operations', () => {
    localStorage.setItem(STORAGE_KEY, '{"workouts":[]}')
    localStorage.setItem(LOCAL_OWNER_KEY, 'account-a')
    localStorage.setItem('gymnotes:outbox:v1', 'queued')

    clearLocalAccountCache()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBeNull()
    expect(localStorage.getItem('gymnotes:outbox:v1')).toBe('queued')
  })
})

describe('normalizeState', () => {
  it('returns an empty state for junk input', () => {
    const state = normalizeState(null)
    expect(state.workouts).toEqual([])
    expect(state.version).toBe(STORAGE_VERSION)
  })

  it('accepts a well-formed backup', () => {
    const state = normalizeState({
      version: 1,
      profile: { name: 'Sam', sex: 'female', age: 30, heightCm: 170, weightKg: 65, unit: 'kg' },
      customExercises: [],
      workouts: [
        {
          id: 'w1',
          date: '2026-01-01',
          exerciseId: 'bench-press',
          sets: [{ reps: 5, weight: 60 }],
          bodyweightKg: 65,
          createdAt: 1,
        },
      ],
    })
    expect(state.workouts).toHaveLength(1)
    expect(state.profile.name).toBe('Sam')
  })

  it('rejects impossible calendar dates', () => {
    const state = normalizeState({
      workouts: [
        { id: 'a', date: '2026-02-31', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
        { id: 'b', date: '2026-13-01', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
        { id: 'c', date: 'not-a-date', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
      ],
    })
    expect(state.workouts).toEqual([])
  })

  it('drops sets with invalid reps or weight', () => {
    const state = normalizeState({
      workouts: [
        {
          id: 'a',
          date: '2026-01-01',
          exerciseId: 'squat',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 0, weight: 100 },
            { reps: 5, weight: -10 },
          ],
        },
      ],
    })
    expect(state.workouts[0].sets).toEqual([{ reps: 5, weight: 100 }])
  })

  it('gives duplicate workout ids a fresh id', () => {
    const state = normalizeState({
      workouts: [
        { id: 'dup', date: '2026-01-01', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
        { id: 'dup', date: '2026-01-02', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
      ],
    })
    expect(new Set(state.workouts.map((w) => w.id)).size).toBe(2)
  })

  it('normalizes habits and drops orphan or duplicate checks', () => {
    const input = {
      version: 1,
      habits: [
        { id: 'h1', name: 'Run', targetPerWeek: 99, note: 'easy pace' },
        { id: 'h2', name: '   ' },
      ],
      habitChecks: [
        { id: 'c1', habitId: 'h1', date: '2026-03-04' },
        { id: 'c2', habitId: 'h1', date: '2026-03-04' },
        { id: 'c3', habitId: 'gone', date: '2026-03-05' },
      ],
    }
    const state = normalizeState(input)

    expect(state.habits).toHaveLength(1)
    expect(state.habits[0].targetPerWeek).toBe(7)
    expect(state.habitChecks).toHaveLength(1)
    expect(validateImport(input).habitsSkipped).toBe(3)
  })

  it('keeps session metadata on workouts', () => {
    const state = normalizeState({
      workouts: [
        {
          id: 'a',
          date: '2026-01-01',
          exerciseId: 'squat',
          sets: [{ reps: 5, weight: 100 }],
          sessionId: 's1',
          sessionName: '  Leg day  ',
          supersetGroup: 2.4,
          position: 3,
        },
      ],
    })

    expect(state.workouts[0]).toMatchObject({
      sessionId: 's1',
      sessionName: 'Leg day',
      supersetGroup: 2,
      position: 3,
    })
  })

  it('normalizes routines and drops invalid entries', () => {
    const state = normalizeState({
      routines: [
        {
          id: 'r1',
          name: '  Push  ',
          entries: [
            { exerciseId: 'bench-press', sets: 3, reps: 8 },
            { exerciseId: 'overhead-press', sets: 0, reps: 8 },
            { exerciseId: 'lateral-raise', sets: 2, reps: 12, supersetGroup: 1 },
          ],
        },
        { id: 'r2', name: 'Empty', entries: [] },
        { id: 'r3', name: '   ', entries: [{ exerciseId: 'squat', sets: 3, reps: 5 }] },
      ],
    })

    expect(state.routines).toHaveLength(1)
    expect(state.routines[0].name).toBe('Push')
    expect(state.routines[0].entries).toHaveLength(2)
    expect(validateImport({ routines: state.routines }).routinesSkipped).toBe(0)
  })

  it('keeps bodyweight-only sets that have zero added weight', () => {
    const state = normalizeState({
      workouts: [
        {
          id: 'a',
          date: '2026-01-01',
          exerciseId: 'pull-up',
          sets: [{ reps: 8, weight: 0 }],
          bodyweightKg: 80,
        },
      ],
    })
    expect(state.workouts[0].sets).toEqual([{ reps: 8, weight: 0 }])
  })
})

describe('validateImport', () => {
  it('flags a version mismatch', () => {
    const result = validateImport({
      version: 99,
      profile: { name: 'A' },
      workouts: [
        { id: 'a', date: '2026-01-01', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
      ],
    })
    expect(result.versionMismatch).toBe(true)
    expect(result.ok).toBe(true)
  })

  it('reports skipped workouts and profile issues', () => {
    const result = validateImport({
      version: 1,
      profile: { name: 'A', age: 500, heightCm: 10, weightKg: 900 },
      workouts: [
        { id: 'a', date: '2026-02-31', exerciseId: 'squat', sets: [{ reps: 5, weight: 100 }] },
      ],
    })
    expect(result.workoutsSkipped).toBe(1)
    expect(result.profileIssues.length).toBe(3)
  })

  it('rejects files that are not backups', () => {
    expect(validateImport('hello').ok).toBe(false)
    expect(validateImport({}).ok).toBe(false)
  })
})
