import { describe, it, expect } from 'vitest'
import {
  exerciseFromRow,
  exerciseToRow,
  hasData,
  profileFromRow,
  profileToRow,
  stateFromRows,
  workoutFromRow,
  workoutToRow,
} from './remote'
import type { ExerciseRow, ProfileRow, WorkoutRow } from './remote'
import { emptyState } from './storage'

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
    expect(workoutFromRow(row)).toEqual(workout)
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
