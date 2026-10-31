import { describe, it, expect } from 'vitest'
import {
  ageFactor,
  bmiInfo,
  e1rm,
  formatWeight,
  formatVolume,
  fromDisplayWeight,
  isPR,
  personalRecordIds,
  setLoadKg,
  standingFor,
  todayISO,
  toDisplayWeight,
  toISODate,
  weekKey,
  weekStreak,
  workoutMetrics,
  workoutVolume,
} from './calc'
import type { Workout } from '../types'

function workout(partial: Partial<Workout> & { date: string; exerciseId: string }): Workout {
  return {
    id: partial.id ?? `w-${Math.random().toString(36).slice(2)}`,
    date: partial.date,
    exerciseId: partial.exerciseId,
    sets: partial.sets ?? [{ reps: 5, weight: 100 }],
    bodyweightKg: partial.bodyweightKg ?? null,
    notes: partial.notes,
    createdAt: partial.createdAt ?? 0,
  }
}

describe('e1rm', () => {
  it('returns the weight for a single rep', () => {
    expect(e1rm(100, 1)).toBe(100)
  })

  it('uses the Epley estimate for multiple reps', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
  })

  it('returns 0 for invalid input', () => {
    expect(e1rm(0, 10)).toBe(0)
    expect(e1rm(100, 0)).toBe(0)
  })
})

describe('formatWeight', () => {
  it('does not double-convert kilograms to pounds', () => {
    // 100 kg is about 220.5 lb — never 100 kg converted twice (~486 lb).
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })

  it('hides decimals for whole kilograms', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
  })

  it('handles missing weight', () => {
    expect(formatWeight(null, 'kg')).toBe('—')
  })
})

describe('unit conversion round-trip', () => {
  it('converts back to the original value', () => {
    expect(fromDisplayWeight(toDisplayWeight(80, 'lb'), 'lb')).toBeCloseTo(80, 6)
  })
})

describe('formatVolume', () => {
  it('formats small volumes without abbreviation', () => {
    expect(formatVolume(1200, 'kg')).toBe('1,200 kg')
  })

  it('abbreviates large volumes', () => {
    expect(formatVolume(12000, 'kg')).toBe('12.0k kg')
    expect(formatVolume(150000, 'kg')).toBe('150k kg')
  })
})

describe('workoutMetrics', () => {
  it('sums volume and finds the best e1RM set', () => {
    const w = workout({
      date: '2026-01-01',
      exerciseId: 'bench-press',
      sets: [
        { reps: 5, weight: 100 },
        { reps: 10, weight: 80 },
      ],
    })
    const metrics = workoutMetrics(w)
    expect(metrics.volume).toBe(5 * 100 + 10 * 80)
    expect(metrics.setCount).toBe(2)
    // 100x5 gives a higher e1RM (116.7) than 80x10 (106.7).
    expect(metrics.e1rm).toBeCloseTo(116.67, 1)
    expect(metrics.bestSet?.weight).toBe(100)
    expect(metrics.topWeight).toBe(100)
  })

  it('adds bodyweight for bodyweight exercises', () => {
    const w = workout({
      date: '2026-01-01',
      exerciseId: 'pull-up',
      sets: [{ reps: 8, weight: 0 }],
      bodyweightKg: 80,
    })
    expect(setLoadKg(w.sets[0], w)).toBe(80)
    expect(workoutMetrics(w).e1rm).toBeCloseTo(e1rm(80, 8), 5)
    expect(workoutVolume(w)).toBeCloseTo(8 * 80, 5)
  })

  it('keeps added weight on top of bodyweight', () => {
    const w = workout({
      date: '2026-01-01',
      exerciseId: 'pull-up',
      sets: [{ reps: 5, weight: 10 }],
      bodyweightKg: 80,
    })
    expect(setLoadKg(w.sets[0], w)).toBe(90)
  })
})

describe('personal records', () => {
  const first = workout({
    id: 'a',
    date: '2026-01-01',
    exerciseId: 'bench-press',
    sets: [{ reps: 5, weight: 80 }],
  })
  const second = workout({
    id: 'b',
    date: '2026-01-08',
    exerciseId: 'bench-press',
    sets: [{ reps: 5, weight: 85 }],
  })
  const third = workout({
    id: 'c',
    date: '2026-01-15',
    exerciseId: 'bench-press',
    sets: [{ reps: 5, weight: 80 }],
  })

  it('does not treat the first session as a PR', () => {
    expect(isPR(first, [first, second, third])).toBe(false)
  })

  it('flags sessions that beat the previous best', () => {
    const prs = personalRecordIds([first, second, third])
    expect(prs.has('a')).toBe(false)
    expect(prs.has('b')).toBe(true)
    expect(prs.has('c')).toBe(false)
  })

  it('compares workouts on the same date by createdAt', () => {
    const early = workout({
      id: 'e',
      date: '2026-02-01',
      exerciseId: 'squat',
      sets: [{ reps: 5, weight: 100 }],
      createdAt: 1,
    })
    const late = workout({
      id: 'l',
      date: '2026-02-01',
      exerciseId: 'squat',
      sets: [{ reps: 5, weight: 110 }],
      createdAt: 2,
    })
    const prs = personalRecordIds([early, late])
    expect(prs.has('l')).toBe(true)
  })
})

describe('dates and streaks', () => {
  it('round-trips an ISO date without timezone drift', () => {
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('computes the Monday of a week', () => {
    // 2026-01-01 is a Thursday; its week starts Monday 2025-12-29.
    expect(weekKey('2026-01-01')).toBe('2025-12-29')
  })

  it('counts consecutive weeks up to the current one', () => {
    const thisWeek = todayISO()
    const lastWeek = workout({ date: addDaysISO(thisWeek, -7), exerciseId: 'squat' })
    const twoWeeks = workout({ date: addDaysISO(thisWeek, -14), exerciseId: 'squat' })
    const current = workout({ date: thisWeek, exerciseId: 'squat' })
    expect(weekStreak([current, lastWeek, twoWeeks])).toBe(3)
  })

  it('returns 0 when the streak is broken', () => {
    const old = workout({ date: addDaysISO(todayISO(), -60), exerciseId: 'squat' })
    expect(weekStreak([old])).toBe(0)
  })
})

describe('ageFactor', () => {
  it('is 1 at the peak', () => {
    expect(ageFactor(22)).toBe(1)
  })

  it('declines with age', () => {
    expect(ageFactor(60)).toBeLessThan(ageFactor(30))
  })

  it('defaults to 1 when age is unknown', () => {
    expect(ageFactor(null)).toBe(1)
  })
})

describe('standingFor', () => {
  it('returns null without a bodyweight', () => {
    expect(standingFor('bench', 100, null, 25, 'male')).toBeNull()
  })

  it('rates a 1x bodyweight bench as intermediate or higher', () => {
    const standing = standingFor('bench', 80, 80, 25, 'male')
    expect(standing).not.toBeNull()
    expect(standing!.ratio).toBeCloseTo(1, 5)
    expect(standing!.levelIndex).toBeGreaterThanOrEqual(3)
  })
})

describe('bmiInfo', () => {
  it('computes BMI and category', () => {
    const bmi = bmiInfo(80, 180)
    expect(bmi?.value).toBeCloseTo(24.69, 1)
    expect(bmi?.category).toBe('Healthy range')
  })

  it('returns null when data is missing', () => {
    expect(bmiInfo(null, 180)).toBeNull()
    expect(bmiInfo(80, null)).toBeNull()
  })
})

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}
