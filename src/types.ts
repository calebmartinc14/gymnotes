export type Tab = 'dashboard' | 'log' | 'progress' | 'profile'

export type Sex = 'male' | 'female' | 'other'
export type Unit = 'kg' | 'lb'

export type MuscleGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core'

export type StandardKey = 'bench' | 'squat' | 'deadlift' | 'ohp' | 'row'

export interface Exercise {
  id: string
  name: string
  group: MuscleGroup
  standard?: StandardKey
  custom?: boolean
  /** Bodyweight movements: the logged weight is treated as added load on top of bodyweight. */
  bodyweight?: boolean
}

/** A single set. Weight is always stored in kilograms. */
export interface SetEntry {
  reps: number
  weight: number
}

export interface Workout {
  id: string
  date: string // YYYY-MM-DD (local)
  exerciseId: string
  sets: SetEntry[]
  /** Bodyweight at the time of the workout, in kg. */
  bodyweightKg: number | null
  notes?: string
  createdAt: number
}

export interface Profile {
  name: string
  sex: Sex
  age: number | null
  heightCm: number | null
  weightKg: number | null
  unit: Unit
}

export interface AppState {
  version: 1
  profile: Profile
  customExercises: Exercise[]
  workouts: Workout[]
}
