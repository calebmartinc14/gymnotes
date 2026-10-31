import type { Exercise, MuscleGroup } from '../types'

export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']

export const EXERCISES: Exercise[] = [
  // Chest
  { id: 'bench-press', name: 'Bench Press', group: 'Chest', standard: 'bench' },
  { id: 'incline-bench', name: 'Incline Bench Press', group: 'Chest' },
  { id: 'db-bench', name: 'Dumbbell Bench Press', group: 'Chest' },
  { id: 'db-incline', name: 'Incline Dumbbell Press', group: 'Chest' },
  { id: 'cable-fly', name: 'Cable Fly', group: 'Chest' },
  { id: 'weighted-dip', name: 'Weighted Dip', group: 'Chest' },
  { id: 'push-up', name: 'Push-up', group: 'Chest', bodyweight: true },

  // Back
  { id: 'deadlift', name: 'Deadlift', group: 'Back', standard: 'deadlift' },
  { id: 'barbell-row', name: 'Barbell Row', group: 'Back', standard: 'row' },
  { id: 'weighted-pullup', name: 'Weighted Pull-up', group: 'Back' },
  { id: 'pull-up', name: 'Pull-up', group: 'Back', bodyweight: true },
  { id: 'lat-pulldown', name: 'Lat Pulldown', group: 'Back' },
  { id: 'seated-row', name: 'Seated Cable Row', group: 'Back' },
  { id: 'single-arm-row', name: 'Single-arm Dumbbell Row', group: 'Back' },

  // Legs
  { id: 'back-squat', name: 'Back Squat', group: 'Legs', standard: 'squat' },
  { id: 'front-squat', name: 'Front Squat', group: 'Legs' },
  { id: 'leg-press', name: 'Leg Press', group: 'Legs' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', group: 'Legs' },
  { id: 'leg-extension', name: 'Leg Extension', group: 'Legs' },
  { id: 'leg-curl', name: 'Leg Curl', group: 'Legs' },
  { id: 'walking-lunge', name: 'Walking Lunge', group: 'Legs', bodyweight: true },
  { id: 'calf-raise', name: 'Standing Calf Raise', group: 'Legs' },

  // Shoulders
  { id: 'overhead-press', name: 'Overhead Press', group: 'Shoulders', standard: 'ohp' },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', group: 'Shoulders' },
  { id: 'lateral-raise', name: 'Lateral Raise', group: 'Shoulders' },
  { id: 'face-pull', name: 'Face Pull', group: 'Shoulders' },
  { id: 'reverse-fly', name: 'Reverse Fly', group: 'Shoulders' },

  // Arms
  { id: 'barbell-curl', name: 'Barbell Curl', group: 'Arms' },
  { id: 'db-curl', name: 'Dumbbell Curl', group: 'Arms' },
  { id: 'hammer-curl', name: 'Hammer Curl', group: 'Arms' },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', group: 'Arms' },
  { id: 'skull-crusher', name: 'Skull Crusher', group: 'Arms' },
  { id: 'close-grip-bench', name: 'Close-grip Bench Press', group: 'Arms' },
  { id: 'bench-dip', name: 'Bench Dip', group: 'Arms', bodyweight: true },

  // Core
  { id: 'cable-crunch', name: 'Cable Crunch', group: 'Core' },
  { id: 'machine-crunch', name: 'Machine Crunch', group: 'Core' },
  { id: 'weighted-situp', name: 'Weighted Sit-up', group: 'Core' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', group: 'Core', bodyweight: true },
  { id: 'plank', name: 'Plank', group: 'Core', bodyweight: true },
]

export function getExercise(id: string, custom: Exercise[]): Exercise | undefined {
  return (
    EXERCISES.find((exercise) => exercise.id === id) ??
    custom.find((exercise) => exercise.id === id)
  )
}

export function isBodyweightExercise(id: string): boolean {
  return EXERCISES.some((exercise) => exercise.id === id && exercise.bodyweight === true)
}

export function allExercises(custom: Exercise[]): Exercise[] {
  return [...EXERCISES, ...custom]
}
