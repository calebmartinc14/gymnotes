import { beforeEach, describe, expect, it } from 'vitest'
import type { Workout } from '../types'
import {
  createOperation,
  enqueue,
  enqueueSnapshot,
  flushOutbox,
  isNetworkError,
  OUTBOX_KEY,
  readOutbox,
  type SyncOperation,
} from './sync'
import { emptyState } from './storage'

const workout: Workout = {
  id: 'w1',
  date: '2026-01-01',
  exerciseId: 'bench-press',
  sets: [{ reps: 5, weight: 100 }],
  bodyweightKg: 80,
  createdAt: 1,
}

function op(userId: string, kind: 'saveWorkout' | 'removeWorkout'): SyncOperation {
  return createOperation(
    userId,
    kind === 'saveWorkout' ? { kind, workout } : { kind, workoutId: 'w1' },
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('outbox queue', () => {
  it('persists operations in order', () => {
    enqueue(op('u1', 'saveWorkout'))
    enqueue(op('u1', 'removeWorkout'))

    const operations = readOutbox()
    expect(operations).toHaveLength(2)
    expect(operations[0].kind).toBe('saveWorkout')
    expect(operations[1].kind).toBe('removeWorkout')
    expect(operations[0].attempts).toBe(0)
  })

  it('ignores corrupt storage', () => {
    localStorage.setItem(OUTBOX_KEY, '{not json')
    expect(readOutbox()).toEqual([])
  })

  it('enqueueSnapshot drops earlier work for the same user only', () => {
    enqueue(op('u1', 'saveWorkout'))
    enqueue(op('u2', 'saveWorkout'))
    const state = emptyState()

    enqueueSnapshot('u1', state)

    const operations = readOutbox()
    expect(operations.filter((item) => item.userId === 'u1')).toHaveLength(1)
    expect(operations.find((item) => item.userId === 'u1')?.kind).toBe('replaceAll')
    expect(operations.filter((item) => item.userId === 'u2')).toHaveLength(1)
  })
})

describe('flushOutbox', () => {
  it('executes and removes operations in order', async () => {
    enqueue(op('u1', 'saveWorkout'))
    enqueue(op('u1', 'removeWorkout'))
    const seen: string[] = []

    const result = await flushOutbox('u1', async (operation) => {
      seen.push(operation.kind)
    })

    expect(seen).toEqual(['saveWorkout', 'removeWorkout'])
    expect(result.processed).toBe(2)
    expect(result.remaining).toBe(0)
    expect(result.error).toBeNull()
    expect(readOutbox()).toEqual([])
  })

  it('keeps the failed operation and stops the queue', async () => {
    enqueue(op('u1', 'saveWorkout'))
    enqueue(op('u1', 'removeWorkout'))
    const seen: string[] = []

    const result = await flushOutbox('u1', async (operation) => {
      seen.push(operation.kind)
      if (operation.kind === 'saveWorkout') throw new Error('offline')
    })

    expect(seen).toEqual(['saveWorkout'])
    expect(result.processed).toBe(0)
    expect(result.remaining).toBe(2)
    expect(result.error).toBeInstanceOf(Error)

    const operations = readOutbox()
    expect(operations).toHaveLength(2)
    expect(operations[0].attempts).toBe(1)
  })

  it('only processes the requested user', async () => {
    enqueue(op('u1', 'saveWorkout'))
    enqueue(op('u2', 'saveWorkout'))
    const seen: string[] = []

    await flushOutbox('u1', async (operation) => {
      seen.push(operation.userId)
    })

    expect(seen).toEqual(['u1'])
    expect(readOutbox()).toHaveLength(1)
    expect(readOutbox()[0].userId).toBe('u2')
  })
})

describe('isNetworkError', () => {
  it('recognises fetch failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'network timeout' })).toBe(true)
    expect(isNetworkError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})
