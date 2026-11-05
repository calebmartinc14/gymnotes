import type {
  AppState,
  Exercise,
  Habit,
  HabitCheck,
  MuscleGroup,
  Profile,
  Routine,
  RoutineEntry,
  SetEntry,
  Sex,
  Unit,
  Workout,
} from '../types'
import { requireSupabase } from './supabase'
import { defaultProfile, normalizeState } from './storage'

// ---------------------------------------------------------------------------
// Row shapes (snake_case, matching supabase/schema.sql)
// ---------------------------------------------------------------------------

export interface ProfileRow {
  user_id: string
  name: string
  sex: string
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  unit: string
}

export interface ExerciseRow {
  id: string
  user_id: string
  name: string
  muscle_group: string
}

export interface WorkoutRow {
  id: string
  user_id: string
  date: string
  exercise_id: string
  sets: SetEntry[]
  bodyweight_kg: number | null
  notes: string | null
  created_at: number
  session_id?: string | null
  session_name?: string | null
  superset_group?: number | null
  position?: number | null
}

export interface RoutineRow {
  id: string
  user_id: string
  name: string
  entries: RoutineEntry[]
  created_at: number
}

export interface HabitRow {
  id: string
  user_id: string
  name: string
  target_per_week: number
  note: string
  created_at: number
}

export interface HabitCheckRow {
  id: string
  user_id: string
  habit_id: string
  date: string
  created_at: number
}

// ---------------------------------------------------------------------------
// Pure mappers — exported so they can be unit-tested without a live project.
// ---------------------------------------------------------------------------

export function workoutFromRow(row: WorkoutRow): Workout {
  return {
    id: row.id,
    date: row.date,
    exerciseId: row.exercise_id,
    sets: Array.isArray(row.sets) ? row.sets : [],
    bodyweightKg: row.bodyweight_kg ?? null,
    notes: row.notes ?? undefined,
    createdAt: Number(row.created_at) || 0,
    sessionId: row.session_id ?? null,
    sessionName: row.session_name ?? undefined,
    supersetGroup: row.superset_group ?? null,
    position: Number(row.position) || 0,
  }
}

export function workoutToRow(userId: string, workout: Workout): WorkoutRow {
  return {
    id: workout.id,
    user_id: userId,
    date: workout.date,
    exercise_id: workout.exerciseId,
    sets: workout.sets,
    bodyweight_kg: workout.bodyweightKg,
    notes: workout.notes ?? null,
    created_at: workout.createdAt,
    session_id: workout.sessionId ?? null,
    session_name: workout.sessionName ?? null,
    superset_group: workout.supersetGroup ?? null,
    position: workout.position ?? 0,
  }
}

export function routineFromRow(row: RoutineRow): Routine {
  const entries = Array.isArray(row.entries)
    ? row.entries.filter(
        (entry): entry is RoutineEntry =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof (entry as RoutineEntry).exerciseId === 'string',
          ),
      )
    : []
  return {
    id: row.id,
    name: row.name,
    entries,
    createdAt: Number(row.created_at) || 0,
  }
}

export function routineToRow(userId: string, routine: Routine): RoutineRow {
  return {
    id: routine.id,
    user_id: userId,
    name: routine.name,
    entries: routine.entries,
    created_at: routine.createdAt,
  }
}

export function habitFromRow(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    targetPerWeek: Number(row.target_per_week) || 7,
    note: typeof row.note === 'string' ? row.note : '',
    createdAt: Number(row.created_at) || 0,
  }
}

export function habitToRow(userId: string, habit: Habit): HabitRow {
  return {
    id: habit.id,
    user_id: userId,
    name: habit.name,
    target_per_week: habit.targetPerWeek,
    note: habit.note,
    created_at: habit.createdAt,
  }
}

export function habitCheckFromRow(row: HabitCheckRow): HabitCheck {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    createdAt: Number(row.created_at) || 0,
  }
}

export function habitCheckToRow(userId: string, check: HabitCheck): HabitCheckRow {
  return {
    id: check.id,
    user_id: userId,
    habit_id: check.habitId,
    date: check.date,
    created_at: check.createdAt,
  }
}

export function exerciseFromRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    group: row.muscle_group as MuscleGroup,
    custom: true,
  }
}

export function exerciseToRow(userId: string, exercise: Exercise): ExerciseRow {
  return {
    id: exercise.id,
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.group,
  }
}

export function profileFromRow(row: ProfileRow | null): Profile {
  if (!row) return defaultProfile()
  const sex: Sex = row.sex === 'female' || row.sex === 'other' ? row.sex : 'male'
  const unit: Unit = row.unit === 'lb' ? 'lb' : 'kg'
  return {
    name: typeof row.name === 'string' ? row.name : '',
    sex,
    age: row.age ?? null,
    heightCm: row.height_cm ?? null,
    weightKg: row.weight_kg ?? null,
    unit,
  }
}

export function profileToRow(userId: string, profile: Profile): ProfileRow {
  return {
    user_id: userId,
    name: profile.name,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    unit: profile.unit,
  }
}

export function stateFromRows(
  profile: Profile,
  customExercises: Exercise[],
  workouts: Workout[],
  habits: Habit[] = [],
  habitChecks: HabitCheck[] = [],
  routines: Routine[] = [],
): AppState {
  return normalizeState({
    version: 2,
    profile,
    customExercises,
    workouts,
    habits,
    habitChecks,
    routines,
  })
}

export function hasData(state: AppState): boolean {
  return (
    state.workouts.length > 0 ||
    state.customExercises.length > 0 ||
    state.habits.length > 0 ||
    state.routines.length > 0 ||
    state.profile.name.trim().length > 0
  )
}

// ---------------------------------------------------------------------------
// Async data access
// ---------------------------------------------------------------------------

/** True when the remote project has not run the latest schema migration yet. */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message, details, hint } = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  if (code === '42P01' || code === 'PGRST205') return true
  if (code === 'PGRST204') return false
  const text = [message, details, hint].filter(Boolean).join(' ')
  if (/could not find the .+ column/i.test(text)) return false
  return /relation .+ does not exist|could not find the table/i.test(text)
}

export function isSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message, details, hint } = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code ?? '')) return true
  const text = [message, details, hint].filter(Boolean).join(' ')
  return /does not exist|could not find the .+ (function|table|column)|schema cache/i.test(text)
}

export async function fetchState(userId: string): Promise<AppState> {
  const client = requireSupabase()
  const [profileRes, exerciseRes, workoutRes, habitRes, checkRes, routineRes] = await Promise.all([
    client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('custom_exercises').select('*').eq('user_id', userId),
    client.from('workouts').select('*').eq('user_id', userId),
    client.from('habits').select('*').eq('user_id', userId),
    client.from('habit_checks').select('*').eq('user_id', userId),
    client.from('routines').select('*').eq('user_id', userId),
  ])
  if (profileRes.error) throw profileRes.error
  if (exerciseRes.error) throw exerciseRes.error
  if (workoutRes.error) throw workoutRes.error
  if (habitRes.error && !isMissingTableError(habitRes.error)) throw habitRes.error
  if (checkRes.error && !isMissingTableError(checkRes.error)) throw checkRes.error
  if (routineRes.error && !isMissingTableError(routineRes.error)) throw routineRes.error

  const profile = profileFromRow((profileRes.data as ProfileRow | null) ?? null)
  const customExercises = ((exerciseRes.data ?? []) as ExerciseRow[]).map(exerciseFromRow)
  const workouts = ((workoutRes.data ?? []) as WorkoutRow[]).map(workoutFromRow)
  const habits = habitRes.error
    ? []
    : ((habitRes.data ?? []) as HabitRow[]).map(habitFromRow)
  const habitChecks = checkRes.error
    ? []
    : ((checkRes.data ?? []) as HabitCheckRow[]).map(habitCheckFromRow)
  const routines = routineRes.error
    ? []
    : ((routineRes.data ?? []) as RoutineRow[]).map(routineFromRow)
  return stateFromRows(profile, customExercises, workouts, habits, habitChecks, routines)
}

export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const { error } = await requireSupabase().from('profiles').upsert(profileToRow(userId, profile))
  if (error) throw error
}

export async function saveExercise(userId: string, exercise: Exercise): Promise<void> {
  const { error } = await requireSupabase()
    .from('custom_exercises')
    .upsert(exerciseToRow(userId, exercise))
  if (error) throw error
}

export async function removeExercise(id: string): Promise<void> {
  const { error } = await requireSupabase().from('custom_exercises').delete().eq('id', id)
  if (error) throw error
}

export async function saveWorkout(userId: string, workout: Workout): Promise<void> {
  const { error } = await requireSupabase().from('workouts').upsert(workoutToRow(userId, workout))
  if (error) throw error
}

export async function removeWorkout(id: string): Promise<void> {
  const { error } = await requireSupabase().from('workouts').delete().eq('id', id)
  if (error) throw error
}

export async function saveRoutine(userId: string, routine: Routine): Promise<void> {
  const { error } = await requireSupabase().from('routines').upsert(routineToRow(userId, routine))
  if (error) throw error
}

export async function removeRoutine(id: string): Promise<void> {
  const { error } = await requireSupabase().from('routines').delete().eq('id', id)
  if (error) throw error
}

export async function saveHabit(userId: string, habit: Habit): Promise<void> {
  const { error } = await requireSupabase().from('habits').upsert(habitToRow(userId, habit))
  if (error) throw error
}

export async function removeHabit(id: string): Promise<void> {
  const { error } = await requireSupabase().from('habits').delete().eq('id', id)
  if (error) throw error
}

export async function saveHabitCheck(userId: string, check: HabitCheck): Promise<void> {
  const { error } = await requireSupabase()
    .from('habit_checks')
    .upsert(habitCheckToRow(userId, check))
  if (error) throw error
}

export async function removeHabitCheck(id: string): Promise<void> {
  const { error } = await requireSupabase().from('habit_checks').delete().eq('id', id)
  if (error) throw error
}

/** Atomically replaces the signed-in user's rows — used by import, demo load and reset. */
export async function replaceAll(state: AppState): Promise<void> {
  const { error } = await requireSupabase().rpc('replace_gymnotes_state', { p_state: state })
  if (error) throw error
}
