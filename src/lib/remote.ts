import type {
  AppState,
  Exercise,
  MuscleGroup,
  Profile,
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
): AppState {
  return normalizeState({ version: 1, profile, customExercises, workouts })
}

export function hasData(state: AppState): boolean {
  return (
    state.workouts.length > 0 ||
    state.customExercises.length > 0 ||
    state.profile.name.trim().length > 0
  )
}

// ---------------------------------------------------------------------------
// Async data access
// ---------------------------------------------------------------------------

export async function fetchState(userId: string): Promise<AppState> {
  const client = requireSupabase()
  const [profileRes, exerciseRes, workoutRes] = await Promise.all([
    client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('custom_exercises').select('*').eq('user_id', userId),
    client.from('workouts').select('*').eq('user_id', userId),
  ])
  if (profileRes.error) throw profileRes.error
  if (exerciseRes.error) throw exerciseRes.error
  if (workoutRes.error) throw workoutRes.error

  const profile = profileFromRow((profileRes.data as ProfileRow | null) ?? null)
  const customExercises = ((exerciseRes.data ?? []) as ExerciseRow[]).map(exerciseFromRow)
  const workouts = ((workoutRes.data ?? []) as WorkoutRow[]).map(workoutFromRow)
  return stateFromRows(profile, customExercises, workouts)
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

/** Replaces every row for the user — used by import, demo load and reset. */
export async function replaceAll(userId: string, state: AppState): Promise<void> {
  const client = requireSupabase()
  const [workoutDelete, exerciseDelete] = await Promise.all([
    client.from('workouts').delete().eq('user_id', userId),
    client.from('custom_exercises').delete().eq('user_id', userId),
  ])
  if (workoutDelete.error) throw workoutDelete.error
  if (exerciseDelete.error) throw exerciseDelete.error

  const profileResult = await client.from('profiles').upsert(profileToRow(userId, state.profile))
  if (profileResult.error) throw profileResult.error

  if (state.customExercises.length > 0) {
    const { error } = await client
      .from('custom_exercises')
      .insert(state.customExercises.map((exercise) => exerciseToRow(userId, exercise)))
    if (error) throw error
  }
  if (state.workouts.length > 0) {
    const { error } = await client
      .from('workouts')
      .insert(state.workouts.map((workout) => workoutToRow(userId, workout)))
    if (error) throw error
  }
}
