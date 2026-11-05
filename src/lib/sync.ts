import type { AppState, Exercise, Habit, HabitCheck, Profile, Routine, Workout } from '../types'
import {
  removeExercise,
  removeHabit,
  removeHabitCheck,
  removeRoutine,
  removeWorkout,
  replaceAll,
  saveExercise,
  saveHabit,
  saveHabitCheck,
  saveProfile,
  saveRoutine,
  saveWorkout,
} from './remote'
import { newId } from './storage'

/**
 * Persistent write-behind queue. Every cloud mutation is appended here first, so
 * a failed or offline request is retried instead of being lost.
 */
export const OUTBOX_KEY = 'gymnotes:outbox:v1'

interface OperationMeta {
  id: string
  userId: string
  createdAt: number
  attempts: number
}

type OperationPayload =
  | { kind: 'replaceAll'; state: AppState }
  | { kind: 'saveProfile'; profile: Profile }
  | { kind: 'saveExercise'; exercise: Exercise }
  | { kind: 'removeExercise'; exerciseId: string }
  | { kind: 'saveWorkout'; workout: Workout }
  | { kind: 'removeWorkout'; workoutId: string }
  | { kind: 'saveHabit'; habit: Habit }
  | { kind: 'removeHabit'; habitId: string }
  | { kind: 'saveHabitCheck'; check: HabitCheck }
  | { kind: 'removeHabitCheck'; checkId: string }
  | { kind: 'saveRoutine'; routine: Routine }
  | { kind: 'removeRoutine'; routineId: string }

export type SyncOperation = OperationMeta & OperationPayload

export type SyncPayload = OperationPayload

export type SyncExecutor = (operation: SyncOperation) => Promise<void>

function isOperation(value: unknown): value is SyncOperation {
  if (!value || typeof value !== 'object') return false
  const operation = value as Partial<SyncOperation>
  return (
    typeof operation.id === 'string' &&
    typeof operation.userId === 'string' &&
    typeof operation.kind === 'string'
  )
}

export function readOutbox(): SyncOperation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isOperation) : []
  } catch {
    return []
  }
}

function writeOutbox(operations: SyncOperation[]): void {
  try {
    if (operations.length === 0) localStorage.removeItem(OUTBOX_KEY)
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(operations))
  } catch {
    // Storage full or blocked. The in-memory state still works; nothing else to do.
  }
}

export function createOperation(userId: string, payload: SyncPayload): SyncOperation {
  return {
    id: newId('sync'),
    userId,
    createdAt: Date.now(),
    attempts: 0,
    ...payload,
  } as SyncOperation
}

export function enqueue(operation: SyncOperation): SyncOperation[] {
  const operations = readOutbox()
  operations.push(operation)
  writeOutbox(operations)
  return operations
}

/** Wait, then retry everything for this user. */
export function pendingFor(userId: string): number {
  return readOutbox().filter((operation) => operation.userId === userId).length
}

/**
 * Drops queued work for a user and replaces it with a single authoritative
 * snapshot. Used by import, demo load and reset, where earlier writes no longer
 * matter.
 */
export function enqueueSnapshot(userId: string, state: AppState): SyncOperation[] {
  const operations = readOutbox().filter((operation) => operation.userId !== userId)
  operations.push(createOperation(userId, { kind: 'replaceAll', state }))
  writeOutbox(operations)
  return operations
}

export async function defaultExecutor(operation: SyncOperation): Promise<void> {
  switch (operation.kind) {
    case 'replaceAll':
      return replaceAll(operation.state)
    case 'saveProfile':
      return saveProfile(operation.userId, operation.profile)
    case 'saveExercise':
      return saveExercise(operation.userId, operation.exercise)
    case 'removeExercise':
      return removeExercise(operation.exerciseId)
    case 'saveWorkout':
      return saveWorkout(operation.userId, operation.workout)
    case 'removeWorkout':
      return removeWorkout(operation.workoutId)
    case 'saveHabit':
      return saveHabit(operation.userId, operation.habit)
    case 'removeHabit':
      return removeHabit(operation.habitId)
    case 'saveHabitCheck':
      return saveHabitCheck(operation.userId, operation.check)
    case 'removeHabitCheck':
      return removeHabitCheck(operation.checkId)
    case 'saveRoutine':
      return saveRoutine(operation.userId, operation.routine)
    case 'removeRoutine':
      return removeRoutine(operation.routineId)
  }
}

export interface FlushResult {
  processed: number
  remaining: number
  error: unknown
}

/**
 * Executes queued operations in order for one user. A failure stops the run so
 * later operations cannot jump ahead of it; the operation stays queued with an
 * incremented attempt count.
 */
export async function flushOutbox(
  userId: string,
  executor: SyncExecutor = defaultExecutor,
): Promise<FlushResult> {
  let processed = 0

  for (let guard = 0; guard < 500; guard += 1) {
    const operations = readOutbox()
    const index = operations.findIndex((operation) => operation.userId === userId)
    if (index === -1) {
      return { processed, remaining: 0, error: null }
    }

    const operation = operations[index]
    try {
      await executor(operation)
    } catch (error) {
      operation.attempts += 1
      operations[index] = operation
      writeOutbox(operations)
      return {
        processed,
        remaining: operations.filter((item) => item.userId === userId).length,
        error,
      }
    }

    operations.splice(index, 1)
    writeOutbox(operations)
    processed += 1
  }

  return {
    processed,
    remaining: pendingFor(userId),
    error: new Error('Sync queue stalled'),
  }
}

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error instanceof TypeError) return true
  if (!error || typeof error !== 'object') return false
  const { message } = error as { message?: string }
  return /fetch|network|offline|timeout/i.test(message ?? '')
}
