import type { Workout } from '../types'
import { compareWorkouts } from './calc'

/**
 * A session is a group of workout rows logged together. Rows written before
 * sessions existed have no `sessionId`, so each one is treated as its own
 * single-exercise session.
 */
export interface SessionGroup {
  id: string
  sessionId: string | null
  date: string
  name: string
  workouts: Workout[]
  createdAt: number
}

export function workoutSessionKey(workout: Workout): string {
  return workout.sessionId ? `session:${workout.sessionId}` : `solo:${workout.id}`
}

export function sortSessionWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort(
    (a, b) =>
      (a.position ?? 0) - (b.position ?? 0) ||
      a.createdAt - b.createdAt ||
      compareWorkouts(a, b),
  )
}

export function groupSessions(workouts: Workout[]): SessionGroup[] {
  const groups = new Map<string, Workout[]>()
  for (const workout of workouts) {
    const key = workoutSessionKey(workout)
    const list = groups.get(key)
    if (list) list.push(workout)
    else groups.set(key, [workout])
  }

  return [...groups.entries()]
    .map(([id, list]) => {
      const ordered = sortSessionWorkouts(list)
      const first = ordered[0]
      return {
        id,
        sessionId: first.sessionId ?? null,
        date: first.date,
        name: first.sessionName ?? '',
        workouts: ordered,
        createdAt: Math.min(...ordered.map((workout) => workout.createdAt)),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

export function sessionFromWorkout(workouts: Workout[], target: Workout): SessionGroup | null {
  const key = workoutSessionKey(target)
  return groupSessions(workouts).find((session) => session.id === key) ?? null
}

export function sessionWorkouts(workouts: Workout[], target: Workout): Workout[] {
  const key = workoutSessionKey(target)
  return sortSessionWorkouts(workouts.filter((workout) => workoutSessionKey(workout) === key))
}

export function countSessions(workouts: Workout[]): number {
  return groupSessions(workouts).length
}
