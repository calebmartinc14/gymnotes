import { describe, it, expect } from 'vitest'
import type { Habit, HabitCheck } from '../types'
import {
  bestHabitStreak,
  buildCheckIndex,
  buildHeatmap,
  checkKey,
  completionLevel,
  dailyCompletion,
  habitStreak,
  habitWeekCount,
  isHabitDone,
  sessionLevel,
  weekCheckins,
} from './habits'

function habit(id: string, targetPerWeek = 3): Habit {
  return { id, name: id, targetPerWeek, note: '', createdAt: 0 }
}

function check(habitId: string, date: string): HabitCheck {
  return { id: `${habitId}-${date}`, habitId, date, createdAt: 0 }
}

describe('check index', () => {
  it('uses one key per habit and day', () => {
    const id = habit('run')
    const date = '2026-03-04'
    const index = buildCheckIndex([check(id.id, date)])

    expect(checkKey(id.id, date)).toBe('run|2026-03-04')
    expect(isHabitDone(index, id.id, date)).toBe(true)
    expect(isHabitDone(index, id.id, '2026-03-05')).toBe(false)
  })
})

describe('dailyCompletion', () => {
  it('returns zero when there are no habits', () => {
    expect(dailyCompletion([], new Map(), '2026-03-04')).toEqual({
      done: 0,
      total: 0,
      ratio: 0,
    })
  })

  it('counts only checks for existing habits', () => {
    const habits = [habit('run'), habit('read')]
    const index = buildCheckIndex([
      check('run', '2026-03-04'),
      check('deleted', '2026-03-04'),
    ])

    expect(dailyCompletion(habits, index, '2026-03-04')).toEqual({
      done: 1,
      total: 2,
      ratio: 0.5,
    })
  })
})

describe('completionLevel', () => {
  it('maps completion ratios to four intensity levels', () => {
    expect(completionLevel(0)).toBe(0)
    expect(completionLevel(0.25)).toBe(1)
    expect(completionLevel(0.5)).toBe(2)
    expect(completionLevel(0.75)).toBe(3)
    expect(completionLevel(1)).toBe(4)
  })
})

describe('sessionLevel', () => {
  it('caps the calendar intensity at four', () => {
    expect(sessionLevel(0)).toBe(0)
    expect(sessionLevel(1)).toBe(1)
    expect(sessionLevel(3)).toBe(3)
    expect(sessionLevel(8)).toBe(4)
  })
})

describe('buildHeatmap', () => {
  it('builds Monday-first columns ending on the given week', () => {
    const grid = buildHeatmap([], [], 2, '2026-03-08')

    expect(grid).toHaveLength(2)
    expect(grid[0]).toHaveLength(7)
    expect(grid[0][0].date).toBe('2026-02-23')
    expect(grid[1][6].date).toBe('2026-03-08')
    expect(grid.flat().some((cell) => cell.future)).toBe(false)
  })

  it('marks the rest of the current week as future', () => {
    const grid = buildHeatmap([], [], 1, '2026-03-04')
    const byDate = new Map(grid.flat().map((cell) => [cell.date, cell]))

    expect(byDate.get('2026-03-04')?.future).toBe(false)
    expect(byDate.get('2026-03-05')?.future).toBe(true)
    expect(byDate.get('2026-03-08')?.future).toBe(true)
  })

  it('fills levels from the selected habits and checks', () => {
    const habits = [habit('run'), habit('read')]
    const grid = buildHeatmap(habits, [check('run', '2026-03-03')], 1, '2026-03-04')
    const cell = grid.flat().find((item) => item.date === '2026-03-03')

    expect(cell).toMatchObject({ done: 1, total: 2, level: 2, future: false })
  })
})

describe('habitStreak', () => {
  it('counts consecutive days ending today', () => {
    const checks = [check('run', '2026-03-02'), check('run', '2026-03-03'), check('run', '2026-03-04')]
    expect(habitStreak('run', checks, '2026-03-04')).toBe(3)
  })

  it('allows a streak ending yesterday', () => {
    const checks = [check('run', '2026-03-02'), check('run', '2026-03-03')]
    expect(habitStreak('run', checks, '2026-03-04')).toBe(2)
  })

  it('breaks when the last two days are missing', () => {
    expect(habitStreak('run', [check('run', '2026-03-01')], '2026-03-04')).toBe(0)
  })

  it('ignores checks for other habits', () => {
    const checks = [check('run', '2026-03-04'), check('read', '2026-03-03')]
    expect(habitStreak('run', checks, '2026-03-04')).toBe(1)
  })
})

describe('weekly helpers', () => {
  const checks = [
    check('run', '2026-03-02'),
    check('run', '2026-03-04'),
    check('run', '2026-03-09'),
    check('orphan', '2026-03-03'),
  ]

  it('counts checks in the week starting Monday', () => {
    expect(habitWeekCount('run', checks, '2026-03-04')).toBe(2)
  })

  it('sums week check-ins for existing habits only', () => {
    const habits = [habit('run')]
    expect(weekCheckins(habits, checks, '2026-03-04')).toBe(2)
  })

  it('returns the best streak across habits', () => {
    const habits = [habit('run'), habit('read')]
    const withRead = [...checks, check('read', '2026-03-03'), check('read', '2026-03-04')]
    expect(bestHabitStreak(habits, withRead, '2026-03-04')).toBe(2)
  })
})
