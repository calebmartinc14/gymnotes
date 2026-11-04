import type { Habit, HabitCheck } from '../types'
import { addDays, todayISO, weekKey } from './calc'

export const GOALS_HEATMAP_WEEKS = 18
export const HABIT_HEATMAP_WEEKS = 12

export function checkKey(habitId: string, date: string): string {
  return `${habitId}|${date}`
}

export function buildCheckIndex(checks: HabitCheck[]): Map<string, HabitCheck> {
  const index = new Map<string, HabitCheck>()
  for (const check of checks) index.set(checkKey(check.habitId, check.date), check)
  return index
}

export function isHabitDone(
  index: Map<string, HabitCheck>,
  habitId: string,
  date: string,
): boolean {
  return index.has(checkKey(habitId, date))
}

export interface DailyCompletion {
  done: number
  total: number
  ratio: number
}

export function dailyCompletion(
  habits: Habit[],
  index: Map<string, HabitCheck>,
  date: string,
): DailyCompletion {
  let done = 0
  for (const habit of habits) {
    if (index.has(checkKey(habit.id, date))) done += 1
  }
  return { done, total: habits.length, ratio: habits.length === 0 ? 0 : done / habits.length }
}

/** GitHub-style intensity: 0 is empty, 4 is every habit done. */
export function completionLevel(ratio: number): number {
  if (ratio <= 0) return 0
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio < 1) return 3
  return 4
}

/** Calendar intensity based on how many sessions were logged in a day. */
export function sessionLevel(sessions: number): number {
  if (sessions <= 0) return 0
  if (sessions === 1) return 1
  if (sessions === 2) return 2
  if (sessions === 3) return 3
  return 4
}

export interface HeatmapCell {
  date: string
  level: number
  done: number
  total: number
  future: boolean
}

export type HeatmapGrid = HeatmapCell[][]

/** Builds Monday-first columns of days, ending on the week of `endDate`. */
export function buildHeatmap(
  habits: Habit[],
  checks: HabitCheck[],
  weeks: number,
  endDate: string = todayISO(),
): HeatmapGrid {
  const index = buildCheckIndex(checks)
  const start = addDays(weekKey(endDate), -(weeks - 1) * 7)
  const grid: HeatmapGrid = []

  for (let week = 0; week < weeks; week += 1) {
    const column: HeatmapCell[] = []
    for (let day = 0; day < 7; day += 1) {
      const date = addDays(start, week * 7 + day)
      const future = date > endDate
      const completion = dailyCompletion(habits, index, date)
      column.push({
        date,
        level: future ? 0 : completionLevel(completion.ratio),
        done: completion.done,
        total: completion.total,
        future,
      })
    }
    grid.push(column)
  }

  return grid
}

export function habitStreak(
  habitId: string,
  checks: HabitCheck[],
  endDate: string = todayISO(),
): number {
  const dates = new Set(checks.filter((check) => check.habitId === habitId).map((c) => c.date))
  let cursor = endDate
  if (!dates.has(cursor)) {
    cursor = addDays(cursor, -1)
    if (!dates.has(cursor)) return 0
  }

  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function habitWeekCount(
  habitId: string,
  checks: HabitCheck[],
  date: string = todayISO(),
): number {
  const start = weekKey(date)
  const end = addDays(start, 6)
  let count = 0
  for (const check of checks) {
    if (check.habitId === habitId && check.date >= start && check.date <= end) count += 1
  }
  return count
}

export function bestHabitStreak(
  habits: Habit[],
  checks: HabitCheck[],
  endDate: string = todayISO(),
): number {
  let best = 0
  for (const habit of habits) {
    best = Math.max(best, habitStreak(habit.id, checks, endDate))
  }
  return best
}

export function weekCheckins(
  habits: Habit[],
  checks: HabitCheck[],
  date: string = todayISO(),
): number {
  const start = weekKey(date)
  const end = addDays(start, 6)
  const ids = new Set(habits.map((habit) => habit.id))
  return checks.filter((check) => ids.has(check.habitId) && check.date >= start && check.date <= end)
    .length
}
