import type { Exercise, Profile, SetEntry, Sex, StandardKey, Unit, Workout } from '../types'
import { getExercise, isBodyweightExercise } from '../data/exercises'

export const KG_PER_LB = 0.45359237

export const LEVELS = [
  'Untrained',
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
] as const

export const LEVEL_COLORS = ['#8b9791', '#7cc4ff', '#5eead4', '#c8f169', '#ffb86b', '#c084fc']

const STANDARDS: Record<StandardKey, { male: number[]; female: number[] }> = {
  bench: {
    male: [0.5, 0.75, 1.0, 1.5, 1.8],
    female: [0.25, 0.4, 0.6, 0.8, 1.0],
  },
  squat: {
    male: [0.75, 1.0, 1.5, 2.0, 2.5],
    female: [0.5, 0.75, 1.0, 1.5, 1.8],
  },
  deadlift: {
    male: [1.0, 1.25, 1.75, 2.5, 3.0],
    female: [0.75, 1.0, 1.25, 1.75, 2.2],
  },
  ohp: {
    male: [0.35, 0.5, 0.65, 0.85, 1.0],
    female: [0.2, 0.3, 0.45, 0.6, 0.7],
  },
  row: {
    male: [0.5, 0.65, 0.85, 1.1, 1.3],
    female: [0.35, 0.5, 0.65, 0.8, 1.0],
  },
}

/**
 * Strength potential by age, relative to the 22–30 peak.
 * Values are approximate and used to keep age comparisons fair.
 */
const AGE_FACTORS: Array<[number, number]> = [
  [14, 0.78],
  [16, 0.85],
  [18, 0.92],
  [20, 0.97],
  [22, 1],
  [30, 0.99],
  [35, 0.96],
  [40, 0.91],
  [45, 0.87],
  [50, 0.82],
  [55, 0.77],
  [60, 0.71],
  [65, 0.65],
  [70, 0.59],
  [75, 0.53],
  [80, 0.48],
  [90, 0.42],
]

export function ageFactor(age: number | null): number {
  if (age === null || !Number.isFinite(age)) return 1
  if (age <= AGE_FACTORS[0][0]) return AGE_FACTORS[0][1]
  const last = AGE_FACTORS[AGE_FACTORS.length - 1]
  if (age >= last[0]) return last[1]

  for (let i = 0; i < AGE_FACTORS.length - 1; i += 1) {
    const [ageA, factorA] = AGE_FACTORS[i]
    const [ageB, factorB] = AGE_FACTORS[i + 1]
    if (age >= ageA && age <= ageB) {
      const t = (age - ageA) / (ageB - ageA)
      return factorA + (factorB - factorA) * t
    }
  }
  return 1
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function toDisplayWeight(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'lb' ? value * KG_PER_LB : value
}

let currentLocale =
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'

const numberFormatters = new Map<number, Intl.NumberFormat>()
const dateFormatters: Record<string, Intl.DateTimeFormat> = {}

export function setCalcLocale(locale: string): void {
  if (!locale || locale === currentLocale) return
  currentLocale = locale
  numberFormatters.clear()
  for (const key of Object.keys(dateFormatters)) delete dateFormatters[key]
}

export function getCalcLocale(): string {
  return currentLocale
}

function numberFormatter(decimals: number): Intl.NumberFormat {
  let formatter = numberFormatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat(currentLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    numberFormatters.set(decimals, formatter)
  }
  return formatter
}

export function formatNumber(value: number, decimals = 0): string {
  return numberFormatter(decimals).format(value)
}

export function formatWeight(kg: number | null, unit: Unit, decimals = 1): string {
  if (kg === null || !Number.isFinite(kg)) return '—'
  const value = round(toDisplayWeight(kg, unit), decimals)
  const isInteger = Number.isInteger(value)
  return `${formatNumber(value, isInteger ? 0 : decimals)} ${unit}`
}

export function formatVolume(kg: number, unit: Unit): string {
  const value = toDisplayWeight(kg, unit)
  if (value >= 100000) return `${formatNumber(round(value / 1000, 0))}k ${unit}`
  if (value >= 10000) return `${formatNumber(round(value / 1000, 1), 1)}k ${unit}`
  return `${formatNumber(round(value, 0))} ${unit}`
}

export function formatRatio(ratio: number): string {
  return `${round(ratio, 2).toFixed(2)}×`
}

export function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface WorkoutMetrics {
  volume: number
  totalReps: number
  setCount: number
  topWeight: number
  topWeightSet: SetEntry | null
  e1rm: number
  bestSet: SetEntry | null
}

/**
 * Effective load for a set. Bodyweight movements add the session bodyweight
 * to any added weight, so volume and e1RM stay meaningful.
 */
export function setLoadKg(set: SetEntry, workout: Workout): number {
  if (isBodyweightExercise(workout.exerciseId)) {
    return set.weight + (workout.bodyweightKg ?? 0)
  }
  return set.weight
}

export function workoutMetrics(workout: Workout): WorkoutMetrics {
  let volume = 0
  let totalReps = 0
  let topWeight = 0
  let topWeightSet: SetEntry | null = null
  let bestE1rm = 0
  let bestSet: SetEntry | null = null

  for (const set of workout.sets) {
    if (set.reps <= 0) continue
    const load = setLoadKg(set, workout)
    if (load <= 0) continue
    volume += set.reps * load
    totalReps += set.reps
    if (load > topWeight) {
      topWeight = load
      topWeightSet = set
    }
    const estimate = e1rm(load, set.reps)
    if (estimate > bestE1rm) {
      bestE1rm = estimate
      bestSet = set
    }
  }

  return {
    volume,
    totalReps,
    setCount: workout.sets.filter((set) => set.reps > 0).length,
    topWeight,
    topWeightSet,
    e1rm: bestE1rm,
    bestSet,
  }
}

export function workoutVolume(workout: Workout): number {
  return workout.sets.reduce((total, set) => total + set.reps * setLoadKg(set, workout), 0)
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

function dateFormatter(style: 'short' | 'medium' | 'long'): Intl.DateTimeFormat {
  let formatter = dateFormatters[style]
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions =
      style === 'short'
        ? { month: 'short', day: 'numeric' }
        : style === 'long'
          ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
          : { month: 'short', day: 'numeric', year: 'numeric' }
    formatter = new Intl.DateTimeFormat(currentLocale, options)
    dateFormatters[style] = formatter
  }
  return formatter
}

export function formatDate(iso: string, style: 'short' | 'medium' | 'long' = 'medium'): string {
  return dateFormatter(style).format(parseISODate(iso))
}

/** Short weekday name (e.g. "Mon" / "lun") in the active locale. */
export function formatWeekday(iso: string): string {
  const key = 'weekday'
  let formatter = dateFormatters[key]
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(currentLocale, { weekday: 'short' })
    dateFormatters[key] = formatter
  }
  return formatter.format(parseISODate(iso))
}

export function weekKey(iso: string): string {
  const date = parseISODate(iso)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  return toISODate(date)
}

export function weekStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0
  const weeks = [...new Set(workouts.map((workout) => weekKey(workout.date)))].sort((a, b) =>
    b.localeCompare(a),
  )
  const current = weekKey(todayISO())
  if (weeks[0] !== current && weeks[0] !== addDays(current, -7)) return 0
  let streak = 1
  for (let i = 0; i < weeks.length - 1; i += 1) {
    if (addDays(weeks[i], -7) === weeks[i + 1]) streak += 1
    else break
  }
  return streak
}

export function sessionsThisWeek(workouts: Workout[]): number {
  const current = weekKey(todayISO())
  return workouts.filter((workout) => weekKey(workout.date) === current).length
}

export function uniqueTrainingDays(workouts: Workout[]): number {
  return new Set(workouts.map((workout) => workout.date)).size
}

export function totalVolume(workouts: Workout[]): number {
  return workouts.reduce((total, workout) => total + workoutVolume(workout), 0)
}

export interface BmiInfo {
  value: number
  category: string
}

export function bmiInfo(weightKg: number | null, heightCm: number | null): BmiInfo | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null
  const value = weightKg / (heightCm / 100) ** 2
  let category = 'Healthy range'
  if (value < 18.5) category = 'Underweight'
  else if (value >= 30) category = 'Obese range'
  else if (value >= 25) category = 'Overweight range'
  return { value, category }
}

export function latestMetricsByExercise(workouts: Workout[]): Map<string, WorkoutMetrics> {
  const sorted = [...workouts].sort(compareWorkouts)
  const result = new Map<string, WorkoutMetrics>()
  for (const workout of sorted) {
    result.set(workout.exerciseId, workoutMetrics(workout))
  }
  return result
}

export function compareWorkouts(a: Workout, b: Workout): number {
  return a.date.localeCompare(b.date) || a.createdAt - b.createdAt
}

/**
 * Returns the set of workout IDs that are personal records.
 * Computed in a single pass per exercise (O(n log n)) instead of O(n²).
 */
export function personalRecordIds(allWorkouts: Workout[]): Set<string> {
  const byExercise = new Map<string, Workout[]>()
  for (const workout of allWorkouts) {
    const list = byExercise.get(workout.exerciseId)
    if (list) list.push(workout)
    else byExercise.set(workout.exerciseId, [workout])
  }

  const prs = new Set<string>()
  for (const list of byExercise.values()) {
    list.sort(compareWorkouts)
    let best = 0
    for (const workout of list) {
      const current = workoutMetrics(workout).e1rm
      if (current <= 0) continue
      if (best > 0 && current > best) prs.add(workout.id)
      if (current > best) best = current
    }
  }
  return prs
}

export function isPR(workout: Workout, allWorkouts: Workout[]): boolean {
  return personalRecordIds(allWorkouts).has(workout.id)
}

function thresholdsFor(key: StandardKey, sex: Sex): number[] {
  const standard = STANDARDS[key]
  if (sex === 'male') return standard.male
  if (sex === 'female') return standard.female
  return standard.male.map((value, index) => (value + standard.female[index]) / 2)
}

export interface StrengthStanding {
  ratio: number
  adjustedRatio: number
  ageFactor: number
  level: string
  levelIndex: number
  score: number
  nextLevel: string | null
  nextRatio: number | null
  remainingRatio: number | null
  remainingKg: number | null
  color: string
}

export function standingFor(
  key: StandardKey,
  e1rmKg: number,
  bodyweightKg: number | null,
  age: number | null,
  sex: Sex,
): StrengthStanding | null {
  if (!bodyweightKg || bodyweightKg <= 0 || e1rmKg <= 0) return null

  const thresholds = thresholdsFor(key, sex)
  const factor = ageFactor(age)
  const ratio = e1rmKg / bodyweightKg
  const adjustedRatio = ratio / factor

  let levelIndex = 0
  let progress = Math.min(1, adjustedRatio / thresholds[0])

  for (let i = thresholds.length - 1; i >= 0; i -= 1) {
    if (adjustedRatio >= thresholds[i]) {
      levelIndex = i + 1
      progress =
        i === thresholds.length - 1
          ? 1
          : (adjustedRatio - thresholds[i]) / (thresholds[i + 1] - thresholds[i])
      break
    }
  }

  const score = Math.min(100, ((levelIndex + progress) / LEVELS.length) * 100)
  const hasNext = levelIndex < LEVELS.length - 1
  const nextThreshold = hasNext ? thresholds[levelIndex] : null
  const nextRatio = nextThreshold === null ? null : nextThreshold * factor
  const remainingRatio = nextRatio === null ? null : Math.max(0, nextRatio - ratio)
  const remainingKg = remainingRatio === null ? null : remainingRatio * bodyweightKg

  return {
    ratio,
    adjustedRatio,
    ageFactor: factor,
    level: LEVELS[levelIndex],
    levelIndex,
    score,
    nextLevel: hasNext ? LEVELS[levelIndex + 1] : null,
    nextRatio,
    remainingRatio,
    remainingKg,
    color: LEVEL_COLORS[levelIndex],
  }
}

export interface TrackedStandard {
  exercise: Exercise
  key: StandardKey
  e1rm: number
  standing: StrengthStanding
}

export function trackedStandards(
  workouts: Workout[],
  customExercises: Exercise[],
  profile: Profile,
): TrackedStandard[] {
  if (!profile.weightKg) return []
  const latest = latestMetricsByExercise(workouts)
  const result: TrackedStandard[] = []

  for (const [exerciseId, metrics] of latest) {
    const exercise = getExercise(exerciseId, customExercises)
    if (!exercise?.standard || metrics.e1rm <= 0) continue
    const standing = standingFor(
      exercise.standard,
      metrics.e1rm,
      profile.weightKg,
      profile.age,
      profile.sex,
    )
    if (standing) result.push({ exercise, key: exercise.standard, e1rm: metrics.e1rm, standing })
  }

  return result.sort((a, b) => b.standing.score - a.standing.score)
}

export function overallStrengthScore(
  workouts: Workout[],
  customExercises: Exercise[],
  profile: Profile,
): number | null {
  const tracked = trackedStandards(workouts, customExercises, profile)
  if (tracked.length === 0) return null
  return tracked.reduce((sum, item) => sum + item.standing.score, 0) / tracked.length
}
