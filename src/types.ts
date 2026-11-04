export type Tab = 'dashboard' | 'log' | 'progress' | 'calendar' | 'goals' | 'profile'

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
  /** Groups entries logged together. Legacy rows have no session id. */
  sessionId?: string | null
  /** Optional name shown for the whole session (usually a routine name). */
  sessionName?: string
  /** Entries with the same positive number are performed as a superset. */
  supersetGroup?: number | null
  /** Order of this exercise inside its session. */
  position?: number
}

export interface Profile {
  name: string
  sex: Sex
  age: number | null
  heightCm: number | null
  weightKg: number | null
  unit: Unit
}

/** A user-defined habit tracked on the goals page. */
export interface Habit {
  id: string
  name: string
  /** How many times per week the habit should be completed (1–7). */
  targetPerWeek: number
  /** Free-form note shown on the habit card. */
  note: string
  createdAt: number
}

/** One completed habit on one day. Presence means "done". */
export interface HabitCheck {
  id: string
  habitId: string
  /** YYYY-MM-DD (local). */
  date: string
  createdAt: number
}

/** Fields needed to create or edit a habit; the id/createdAt are managed by the app. */
export type HabitDraft = Pick<Habit, 'name' | 'targetPerWeek' | 'note'>

/** One exercise slot in a saved routine. */
export interface RoutineEntry {
  exerciseId: string
  /** Number of sets to pre-fill. */
  sets: number
  /** Target reps to pre-fill on each set. */
  reps: number
  supersetGroup?: number | null
}

export interface Routine {
  id: string
  name: string
  entries: RoutineEntry[]
  createdAt: number
}

export interface AppState {
  version: 2
  profile: Profile
  customExercises: Exercise[]
  workouts: Workout[]
  habits: Habit[]
  habitChecks: HabitCheck[]
  routines: Routine[]
}
