import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exerciseFromRow,
  exerciseToRow,
  hasData,
  isMissingTableError,
  isSchemaError,
  replaceAll,
  profileFromRow,
  profileToRow,
  stateFromRows,
  workoutFromRow,
  workoutToRow,
} from './remote'
import type { ExerciseRow, ProfileRow, WorkoutRow } from './remote'
import { emptyState } from './storage'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('./supabase', () => ({
  requireSupabase: () => ({ rpc: rpcMock }),
}))

beforeEach(() => rpcMock.mockReset())

describe('workout row mapping', () => {
  it('round-trips a workout', () => {
    const workout = {
      id: 'workout-1',
      date: '2026-01-01',
      exerciseId: 'bench-press',
      sets: [{ reps: 5, weight: 100 }],
      bodyweightKg: 80,
      notes: 'solid',
      createdAt: 123,
    }
    const row = workoutToRow('user-1', workout)
    expect(row.user_id).toBe('user-1')
    expect(row.bodyweight_kg).toBe(80)
    expect(workoutFromRow(row)).toEqual({
      ...workout,
      sessionId: null,
      sessionName: undefined,
      supersetGroup: null,
      position: 0,
    })
  })

  it('maps a missing note to undefined', () => {
    const row: WorkoutRow = {
      id: 'w',
      user_id: 'u',
      date: '2026-01-01',
      exercise_id: 'squat',
      sets: [],
      bodyweight_kg: null,
      notes: null,
      created_at: 0,
    }
    expect(workoutFromRow(row).notes).toBeUndefined()
  })
})

describe('exercise row mapping', () => {
  it('round-trips a custom exercise', () => {
    const exercise = { id: 'custom-1', name: 'Curl', group: 'Arms' as const, custom: true }
    const row = exerciseToRow('user-1', exercise)
    expect(row).toEqual({
      id: 'custom-1',
      user_id: 'user-1',
      name: 'Curl',
      muscle_group: 'Arms',
    })
    expect(exerciseFromRow(row as ExerciseRow)).toEqual(exercise)
  })
})

describe('profile row mapping', () => {
  it('round-trips a profile', () => {
    const profile = {
      name: 'Sam',
      sex: 'female' as const,
      age: 30,
      heightCm: 170,
      weightKg: 65,
      unit: 'kg' as const,
    }
    expect(profileFromRow(profileToRow('u', profile))).toEqual(profile)
  })

  it('falls back to defaults for a missing row', () => {
    const profile = profileFromRow(null)
    expect(profile.name).toBe('')
    expect(profile.unit).toBe('kg')
  })

  it('coerces unknown values to safe defaults', () => {
    const row: ProfileRow = {
      user_id: 'u',
      name: 'A',
      sex: 'alien',
      age: null,
      height_cm: null,
      weight_kg: null,
      unit: 'stone',
    }
    const profile = profileFromRow(row)
    expect(profile.sex).toBe('male')
    expect(profile.unit).toBe('kg')
  })
})

describe('stateFromRows', () => {
  it('normalizes assembled rows', () => {
    const state = stateFromRows(
      profileFromRow(null),
      [exerciseFromRow({ id: 'custom-1', user_id: 'u', name: 'Curl', muscle_group: 'Arms' })],
      [
        workoutFromRow({
          id: 'w1',
          user_id: 'u',
          date: '2026-01-01',
          exercise_id: 'bench-press',
          sets: [{ reps: 5, weight: 100 }],
          bodyweight_kg: 80,
          notes: null,
          created_at: 1,
        }),
      ],
    )
    expect(state.workouts).toHaveLength(1)
    expect(state.customExercises).toHaveLength(1)
  })
})

describe('isMissingTableError', () => {
  it('detects a missing relation from postgres', () => {
    expect(
      isMissingTableError({
        code: '42P01',
        message: 'relation "public.habits" does not exist',
      }),
    ).toBe(true)
  })

  it('detects a table missing from the PostgREST schema cache', () => {
    expect(
      isMissingTableError({
        code: 'PGRST205',
        message: "Could not find the table 'public.habits' in the schema cache",
      }),
    ).toBe(true)
  })

  it('does not treat a missing column as a missing table', () => {
    expect(
      isMissingTableError({
        code: 'PGRST204',
        message: "Could not find the 'note' column of 'habits' in the schema cache",
      }),
    ).toBe(false)
  })

  it('ignores unrelated errors', () => {
    expect(isMissingTableError({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })

  it('recognises schema errors without conflating missing columns with missing tables', () => {
    const missingColumn = {
      code: 'PGRST204',
      message: "Could not find the 'note' column of 'habits' in the schema cache",
    }
    expect(isMissingTableError(missingColumn)).toBe(false)
    expect(isSchemaError(missingColumn)).toBe(true)
    expect(
      isSchemaError({
        code: 'PGRST202',
        message: 'Could not find the function public.replace_gymnotes_state in the schema cache',
      }),
    ).toBe(true)
    expect(isSchemaError({ code: '42501', message: 'permission denied' })).toBe(false)
  })
})

describe('hasData', () => {
  it('is false for an empty state', () => {
    expect(hasData(emptyState())).toBe(false)
  })

  it('is true when a workout exists', () => {
    const state = stateFromRows(
      profileFromRow(null),
      [],
      [
        workoutFromRow({
          id: 'w1',
          user_id: 'u',
          date: '2026-01-01',
          exercise_id: 'bench-press',
          sets: [{ reps: 5, weight: 100 }],
          bodyweight_kg: 80,
          notes: null,
          created_at: 1,
        }),
      ],
    )
    expect(hasData(state)).toBe(true)
  })
})

describe('replaceAll', () => {
  it('sends one full-state RPC so the server can replace the dataset transactionally', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const state = emptyState()
    state.profile.name = 'Sam'

    await replaceAll(state)

    expect(rpcMock).toHaveBeenCalledOnce()
    expect(rpcMock).toHaveBeenCalledWith('replace_gymnotes_state', { p_state: state })
  })

  it('keeps a failed replacement visible to the sync outbox', async () => {
    const failure = new Error('database unavailable')
    rpcMock.mockResolvedValue({ error: failure })

    await expect(replaceAll(emptyState())).rejects.toBe(failure)
  })
})
