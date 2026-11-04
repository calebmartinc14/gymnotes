import type { AppState, Habit, HabitCheck, Workout } from '../types'
import { addDays, parseISODate, round, todayISO } from '../lib/calc'
import { newId } from '../lib/storage'

interface DemoPlan {
  exerciseId: string
  base: number
  step: number
  reps: number[]
  offset: number
}

const PLAN: DemoPlan[] = [
  { exerciseId: 'bench-press', base: 55, step: 1.5, reps: [8, 8, 7], offset: 0 },
  { exerciseId: 'back-squat', base: 75, step: 2.5, reps: [5, 5, 5], offset: 2 },
  { exerciseId: 'deadlift', base: 95, step: 3, reps: [5, 5, 3], offset: 4 },
  { exerciseId: 'overhead-press', base: 32.5, step: 1, reps: [8, 8, 8], offset: 5 },
]

export function demoState(): AppState {
  const today = todayISO()
  const workouts: Workout[] = []

  for (let week = 0; week < 12; week += 1) {
    for (const plan of PLAN) {
      const daysAgo = (11 - week) * 7 + plan.offset
      if (daysAgo < 0) continue
      const date = addDays(today, -daysAgo)
      const weight = round(plan.base + plan.step * week, 1)
      const bodyweight = round(78 + Math.sin(week / 2.2) * 0.5, 1)
      workouts.push({
        id: newId('demo'),
        date,
        exerciseId: plan.exerciseId,
        sets: plan.reps.map((reps) => ({ reps, weight })),
        bodyweightKg: bodyweight,
        createdAt: parseISODate(date).getTime() + plan.offset * 60_000,
      })
    }
  }

  const habits: Habit[] = [
    {
      id: 'demo-habit-train',
      name: 'Train',
      targetPerWeek: 4,
      note: 'Four sessions a week. Consistency beats perfect programming.',
      createdAt: parseISODate(addDays(today, -83)).getTime(),
    },
    {
      id: 'demo-habit-walk',
      name: 'Walk 10k steps',
      targetPerWeek: 6,
      note: 'Easy movement on rest days keeps recovery on track.',
      createdAt: parseISODate(addDays(today, -83)).getTime(),
    },
    {
      id: 'demo-habit-stretch',
      name: 'Stretch 10 minutes',
      targetPerWeek: 3,
      note: 'Hips and shoulders after training.',
      createdAt: parseISODate(addDays(today, -83)).getTime(),
    },
  ]

  const habitChecks: HabitCheck[] = []
  for (let daysAgo = 0; daysAgo < 84; daysAgo += 1) {
    const date = addDays(today, -daysAgo)
    const weekday = parseISODate(date).getDay()
    const createdAt = parseISODate(date).getTime() + 20 * 60_000

    if (weekday === 1 || weekday === 2 || weekday === 4 || weekday === 5) {
      habitChecks.push({ id: newId('demo-check'), habitId: 'demo-habit-train', date, createdAt })
    }
    if (weekday !== 0 && daysAgo % 4 !== 1) {
      habitChecks.push({ id: newId('demo-check'), habitId: 'demo-habit-walk', date, createdAt })
    }
    if (weekday === 1 || weekday === 3 || weekday === 6) {
      habitChecks.push({ id: newId('demo-check'), habitId: 'demo-habit-stretch', date, createdAt })
    }
  }

  return {
    version: 2,
    profile: {
      name: 'Alex',
      sex: 'male',
      age: 29,
      heightCm: 178,
      weightKg: 78,
      unit: 'kg',
    },
    customExercises: [],
    workouts,
    habits,
    habitChecks,
    routines: [],
  }
}
