import type { AppState, Exercise, Profile, SetEntry, Workout } from '../types'

export const STORAGE_KEY = 'gymnotes:v1'
export const STORAGE_VERSION = 1

export interface ValidationResult {
  ok: boolean
  workoutsSkipped: number
  exercisesSkipped: number
  profileIssues: string[]
  versionMismatch: boolean
}

export function newId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultProfile(): Profile {
  return {
    name: '',
    sex: 'male',
    age: null,
    heightCm: null,
    weightKg: null,
    unit: 'kg',
  }
}

export function emptyState(): AppState {
  return {
    version: STORAGE_VERSION,
    profile: defaultProfile(),
    customExercises: [],
    workouts: [],
  }
}

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return normalizeState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    year >= 1900 &&
    year <= 2100
  )
}

function validateProfile(profile: Partial<Profile>): { profile: Profile; issues: string[] } {
  const issues: string[] = []
  const name = typeof profile.name === 'string' ? profile.name.slice(0, 60) : ''
  const sex = profile.sex === 'female' || profile.sex === 'other' ? profile.sex : 'male'
  const age = numberOrNull(profile.age)
  const heightCm = numberOrNull(profile.heightCm)
  const weightKg = numberOrNull(profile.weightKg)
  const unit = profile.unit === 'lb' ? 'lb' : 'kg'

  if (age !== null && (age < 10 || age > 100)) {
    issues.push('Age out of range (10–100)')
  }
  if (heightCm !== null && (heightCm < 100 || heightCm > 250)) {
    issues.push('Height out of range (100–250 cm)')
  }
  if (weightKg !== null && (weightKg < 25 || weightKg > 400)) {
    issues.push('Weight out of range (25–400 kg)')
  }

  return {
    profile: { name, sex, age, heightCm, weightKg, unit },
    issues,
  }
}

function normalizeSets(value: unknown): SetEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((set) => {
      if (!set || typeof set !== 'object') return null
      const reps = Math.round(numberOrNull((set as SetEntry).reps) ?? 0)
      const weight = numberOrNull((set as SetEntry).weight) ?? 0
      if (reps <= 0 || weight < 0) return null
      return { reps, weight }
    })
    .filter((set): set is SetEntry => set !== null)
}

function normalizeWorkout(value: unknown): Workout | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<Workout>
  if (typeof raw.date !== 'string' || !isValidDate(raw.date)) return null
  if (typeof raw.exerciseId !== 'string' || !raw.exerciseId) return null
  const sets = normalizeSets(raw.sets)
  if (sets.length === 0) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('workout'),
    date: raw.date,
    exerciseId: raw.exerciseId,
    sets,
    bodyweightKg: numberOrNull(raw.bodyweightKg),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : undefined,
    createdAt: numberOrNull(raw.createdAt) ?? Date.now(),
  }
}

function normalizeExercise(value: unknown): Exercise | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<Exercise>
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null
  const groups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']
  const group = groups.includes(raw.group ?? '') ? raw.group! : 'Chest'
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 60),
    group: group as Exercise['group'],
    custom: true,
  }
}

function deduplicateWorkouts(workouts: Workout[]): Workout[] {
  const seen = new Set<string>()
  const result: Workout[] = []
  for (const workout of workouts) {
    if (seen.has(workout.id)) {
      const newWorkout = { ...workout, id: newId('workout') }
      result.push(newWorkout)
    } else {
      seen.add(workout.id)
      result.push(workout)
    }
  }
  return result
}

function deduplicateExercises(exercises: Exercise[]): Exercise[] {
  const seen = new Set<string>()
  const result: Exercise[] = []
  for (const exercise of exercises) {
    if (seen.has(exercise.id)) {
      const newExercise = { ...exercise, id: newId('custom') }
      result.push(newExercise)
    } else {
      seen.add(exercise.id)
      result.push(exercise)
    }
  }
  return result
}

interface ParseOutput {
  state: AppState
  workoutsSkipped: number
  exercisesSkipped: number
  profileIssues: string[]
  versionMismatch: boolean
}

function parseState(input: unknown): ParseOutput {
  if (!input || typeof input !== 'object') {
    return {
      state: emptyState(),
      workoutsSkipped: 0,
      exercisesSkipped: 0,
      profileIssues: ['Invalid backup format'],
      versionMismatch: false,
    }
  }
  const raw = input as Partial<AppState>

  const versionMismatch = raw.version !== STORAGE_VERSION && raw.version !== undefined
  const { profile, issues: profileIssues } = validateProfile(
    (raw.profile ?? {}) as Partial<Profile>,
  )

  const rawWorkouts = Array.isArray(raw.workouts) ? raw.workouts : []
  const normalizedWorkouts = rawWorkouts
    .map(normalizeWorkout)
    .filter((workout): workout is Workout => workout !== null)
  const workouts = deduplicateWorkouts(normalizedWorkouts)
  const workoutsSkipped = rawWorkouts.length - workouts.length

  const rawExercises = Array.isArray(raw.customExercises) ? raw.customExercises : []
  const normalizedExercises = rawExercises
    .map(normalizeExercise)
    .filter((exercise): exercise is Exercise => exercise !== null)
  const customExercises = deduplicateExercises(normalizedExercises)
  const exercisesSkipped = rawExercises.length - customExercises.length

  return {
    state: { version: STORAGE_VERSION, profile, customExercises, workouts },
    workoutsSkipped,
    exercisesSkipped,
    profileIssues,
    versionMismatch,
  }
}

export function normalizeState(input: unknown): AppState {
  return parseState(input).state
}

export function validateImport(input: unknown): ValidationResult {
  const { state, workoutsSkipped, exercisesSkipped, profileIssues, versionMismatch } =
    parseState(input)
  const hasData =
    state.workouts.length > 0 ||
    state.profile.name.trim().length > 0 ||
    state.customExercises.length > 0

  return {
    ok: hasData,
    workoutsSkipped,
    exercisesSkipped,
    profileIssues,
    versionMismatch,
  }
}
