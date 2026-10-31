import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AppState, Exercise, MuscleGroup, Workout } from '../types'
import { EXERCISES, MUSCLE_GROUPS, getExercise } from '../data/exercises'
import {
  compareWorkouts,
  formatDate,
  formatVolume,
  formatWeight,
  fromDisplayWeight,
  round,
  setLoadKg,
  todayISO,
  toDisplayWeight,
  workoutMetrics,
} from '../lib/calc'
import { newId } from '../lib/storage'
import { exerciseLabel, muscleLabel, useI18n } from '../lib/i18n'
import {
  CheckIcon,
  CloseIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  UserIcon,
} from './Icons'
import { PageHead } from './ui'

interface LogWorkoutProps {
  state: AppState
  editing?: Workout | null
  onSave: (workout: Workout) => void
  onUpdate?: (workout: Workout) => void
  onCancelEdit?: () => void
  onAddExercise: (exercise: Exercise) => void
  onProfile: () => void
}

interface SetRow {
  key: string
  reps: string
  weight: string
}

function blankSets(count = 3): SetRow[] {
  return Array.from({ length: count }, () => ({ key: newId('set'), reps: '', weight: '' }))
}

function rowsFromWorkout(workout: Workout, unit: 'kg' | 'lb'): SetRow[] {
  return workout.sets.map((set) => ({
    key: newId('set'),
    reps: String(set.reps),
    weight: String(round(toDisplayWeight(set.weight, unit), 2)),
  }))
}

export function LogWorkout({
  state,
  editing,
  onSave,
  onUpdate,
  onCancelEdit,
  onAddExercise,
  onProfile,
}: LogWorkoutProps) {
  const { t } = useI18n()
  const { profile, workouts, customExercises } = state
  const unit = profile.unit
  const latestExercise = [...workouts].sort((a, b) => b.createdAt - a.createdAt)[0]?.exerciseId

  const [selectedId, setSelectedId] = useState(
    editing?.exerciseId ?? latestExercise ?? 'bench-press',
  )
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'All'>('All')
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [sets, setSets] = useState<SetRow[]>(() =>
    editing ? rowsFromWorkout(editing, unit) : blankSets(),
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customGroup, setCustomGroup] = useState<MuscleGroup>('Chest')

  useEffect(() => {
    if (!editing) return
    setSelectedId(editing.exerciseId)
    setDate(editing.date)
    setSets(rowsFromWorkout(editing, unit))
    setNotes(editing.notes ?? '')
    setError('')
  }, [editing, unit])

  const selected = getExercise(selectedId, customExercises)
  const isBodyweight = selected?.bodyweight === true
  const bodyweightKg = profile.weightKg ?? 0
  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allExercises.filter((exercise) => {
      const matchesGroup = group === 'All' || exercise.group === group
      const label = exerciseLabel(exercise, t)
      const groupLabel = muscleLabel(exercise.group, t)
      const matchesSearch =
        !query ||
        label.toLowerCase().includes(query) ||
        exercise.name.toLowerCase().includes(query) ||
        groupLabel.toLowerCase().includes(query)
      return matchesGroup && matchesSearch
    })
  }, [allExercises, group, search, t])

  const lastSession = useMemo(() => {
    const sessions = workouts
      .filter((workout) => workout.exerciseId === selectedId)
      .sort(compareWorkouts)
    return sessions[sessions.length - 1]
  }, [selectedId, workouts])

  /** Effective load in kg for one set row, including bodyweight when relevant. */
  const rowLoadKg = useCallback(
    (row: SetRow): number => {
      const weight = Number(row.weight)
      if (!Number.isFinite(weight) || weight < 0) return 0
      return fromDisplayWeight(weight, unit) + (isBodyweight ? bodyweightKg : 0)
    },
    [unit, isBodyweight, bodyweightKg],
  )

  const previewVolume = useMemo(
    () =>
      sets.reduce((total, set) => {
        const reps = Number(set.reps)
        if (!Number.isFinite(reps) || reps <= 0) return total
        const load = rowLoadKg(set)
        if (load <= 0) return total
        return total + reps * load
      }, 0),
    [sets, rowLoadKg],
  )

  const validSetCount = sets.filter((set) => {
    const reps = Number(set.reps)
    if (!Number.isFinite(reps) || reps <= 0) return false
    if (!set.weight.trim()) return isBodyweight
    const weight = Number(set.weight)
    return Number.isFinite(weight) && weight >= 0 && (isBodyweight || weight > 0)
  }).length

  function updateSet(key: string, field: 'reps' | 'weight', value: string) {
    setSets((current) => current.map((set) => (set.key === key ? { ...set, [field]: value } : set)))
    setError('')
  }

  function addSet() {
    const last = sets[sets.length - 1]
    setSets((current) => [
      ...current,
      {
        key: newId('set'),
        reps: last?.reps ?? '',
        weight: last?.weight ?? '',
      },
    ])
  }

  function removeSet(key: string) {
    setSets((current) =>
      current.length === 1 ? current : current.filter((set) => set.key !== key),
    )
  }

  function repeatLast() {
    if (!lastSession) return
    setSets(
      lastSession.sets.map((set) => ({
        key: newId('set'),
        reps: String(set.reps),
        weight: String(round(toDisplayWeight(set.weight, unit), 1)),
      })),
    )
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return

    const filled = sets.filter((set) => set.reps.trim() || set.weight.trim())
    if (filled.length === 0) {
      setError(t('log.errNoSets'))
      return
    }

    const parsed: Array<{ reps: number; weight: number }> = []
    for (const set of filled) {
      const reps = Number(set.reps)
      if (!set.reps.trim() || !Number.isFinite(reps) || reps <= 0 || !Number.isInteger(reps)) {
        setError(t('log.errInvalidSet'))
        return
      }

      if (isBodyweight) {
        const added = set.weight.trim() ? Number(set.weight) : 0
        if (!Number.isFinite(added) || added < 0) {
          setError(t('log.errNegative'))
          return
        }
        parsed.push({ reps, weight: fromDisplayWeight(added, unit) })
      } else {
        const weight = Number(set.weight)
        if (!set.weight.trim() || !Number.isFinite(weight) || weight <= 0) {
          setError(t('log.errInvalidSet'))
          return
        }
        parsed.push({ reps, weight: fromDisplayWeight(weight, unit) })
      }
    }

    if (!date) {
      setError(t('log.errDate'))
      return
    }
    if (date > todayISO()) {
      setError(t('log.errFuture'))
      return
    }

    const next: Workout = editing
      ? {
          ...editing,
          date,
          exerciseId: selected.id,
          sets: parsed,
          notes: notes.trim() || undefined,
        }
      : {
          id: newId('workout'),
          date,
          exerciseId: selected.id,
          sets: parsed,
          bodyweightKg: profile.weightKg,
          notes: notes.trim() || undefined,
          createdAt: Date.now(),
        }

    if (editing) onUpdate?.(next)
    else onSave(next)
  }

  function createCustom() {
    const name = customName.trim()
    if (!name) return
    const exercise: Exercise = {
      id: newId('custom'),
      name,
      group: customGroup,
      custom: true,
    }
    onAddExercise(exercise)
    setSelectedId(exercise.id)
    setCustomName('')
    setShowCustom(false)
    setSearch('')
    setGroup('All')
  }

  return (
    <div className="page">
      <PageHead
        kicker={editing ? t('log.kickerEdit') : t('log.kickerNew')}
        title={editing ? t('log.titleEdit') : t('log.titleNew')}
        subtitle={editing ? t('log.subtitleEdit') : t('log.subtitleNew')}
        actions={
          editing ? (
            <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>
              {t('action.cancelEdit')}
            </button>
          ) : undefined
        }
      />

      <div className="log-layout">
        <section className="card exercise-picker" aria-label={t('log.chooseExerciseAria')}>
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('log.step1')}</span>
              <h3>{t('log.chooseExercise')}</h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCustom((value) => !value)}
            >
              {showCustom ? <CloseIcon size={15} /> : <PlusIcon size={15} />}
              {showCustom ? t('action.cancel') : t('action.custom')}
            </button>
          </div>

          {showCustom && (
            <div className="custom-exercise-form">
              <input
                type="text"
                placeholder={t('log.exerciseNamePlaceholder')}
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                maxLength={60}
                aria-label={t('log.customNameAria')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    createCustom()
                  }
                }}
              />
              <select
                value={customGroup}
                onChange={(event) => setCustomGroup(event.target.value as MuscleGroup)}
                aria-label={t('log.muscleGroupAria')}
              >
                {MUSCLE_GROUPS.map((item) => (
                  <option key={item} value={item}>
                    {muscleLabel(item, t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={createCustom}
                disabled={!customName.trim()}
              >
                {t('action.add')}
              </button>
            </div>
          )}

          <div className="search-field">
            <SearchIcon size={17} />
            <input
              type="search"
              placeholder={t('log.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t('log.searchAria')}
            />
          </div>

          <div className="filter-chips" role="group" aria-label={t('log.filterAria')}>
            <button
              type="button"
              className={`chip${group === 'All' ? ' chip-active' : ''}`}
              aria-pressed={group === 'All'}
              onClick={() => setGroup('All')}
            >
              {t('common.all')}
            </button>
            {MUSCLE_GROUPS.map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${group === item ? ' chip-active' : ''}`}
                aria-pressed={group === item}
                onClick={() => setGroup(item)}
              >
                {muscleLabel(item, t)}
              </button>
            ))}
          </div>

          <div className="exercise-grid">
            {filtered.map((exercise) => (
              <button
                type="button"
                key={exercise.id}
                className={`exercise-option${selectedId === exercise.id ? ' selected' : ''}`}
                aria-pressed={selectedId === exercise.id}
                onClick={() => setSelectedId(exercise.id)}
              >
                <span className="exercise-option-copy">
                  <strong>{exerciseLabel(exercise, t)}</strong>
                  <span>
                    {muscleLabel(exercise.group, t)}
                    {exercise.custom ? t('log.customSuffix') : ''}
                  </span>
                </span>
                <span className="exercise-check">
                  {selectedId === exercise.id ? <CheckIcon size={14} /> : null}
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="picker-empty">
              <SearchIcon size={20} />
              <p>{t('log.noMatch', { search })}</p>
            </div>
          )}
        </section>

        <form className="card session-card" onSubmit={submit} noValidate>
          <div className="card-head session-head">
            <div>
              <span className="card-kicker">{t('log.step2')}</span>
              <h3>{selected ? exerciseLabel(selected, t) : t('log.sessionDetails')}</h3>
              <p className="session-sub">
                {selected
                  ? `${muscleLabel(selected.group, t)} · ${
                      selected.custom ? t('log.exerciseTypeCustom') : t('log.exerciseTypeLibrary')
                    }`
                  : t('log.pickToBegin')}
              </p>
            </div>
            <span className="session-badge">
              <SparklesIcon size={15} />
              {t('log.setCount', { count: validSetCount })}
            </span>
          </div>

          <div className="date-row">
            <label className="field">
              <span>{t('log.date')}</span>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <div className="bodyweight-snapshot">
              <span>{t('log.bodyweight')}</span>
              <strong>
                <UserIcon size={14} />
                {profile.weightKg ? formatWeight(profile.weightKg, unit) : t('log.notSet')}
              </strong>
              <button type="button" className="inline-link" onClick={onProfile}>
                {profile.weightKg ? t('action.edit') : t('action.add')}
              </button>
            </div>
          </div>

          {!profile.weightKg && (
            <div className="inline-alert">
              <InfoIcon size={16} />
              <p>
                {t('log.bodyweightAlert')}{' '}
                <button type="button" className="inline-link" onClick={onProfile}>
                  {t('action.goToProfile')}
                </button>
              </p>
            </div>
          )}

          {lastSession && (
            <div className="last-session">
              <div className="last-session-copy">
                <span>
                  {t('log.lastTime', {
                    date: formatDate(lastSession.date, 'short'),
                    e1rm: formatWeight(workoutMetrics(lastSession).e1rm, unit),
                  })}
                </span>
                <strong>
                  {lastSession.sets
                    .map(
                      (set) =>
                        `${round(toDisplayWeight(setLoadKg(set, lastSession), unit), 1)} ${unit} × ${set.reps}`,
                    )
                    .join('  ·  ')}
                </strong>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={repeatLast}>
                {t('action.repeat')}
              </button>
            </div>
          )}

          {isBodyweight && (
            <div className="inline-alert">
              <InfoIcon size={16} />
              <p>{t('log.bodyweightExercise')}</p>
            </div>
          )}

          <div className="sets-block">
            <div className="sets-header">
              <span>{t('log.set')}</span>
              <span>{t('log.reps')}</span>
              <span>{t('log.weight')}</span>
              <span aria-hidden="true" />
            </div>

            {sets.map((set, index) => (
              <div className="set-row" key={set.key}>
                <span className="set-number">{index + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="8"
                  value={set.reps}
                  onChange={(event) => updateSet(set.key, 'reps', event.target.value)}
                  aria-label={t('log.setRepsAria', { index: index + 1 })}
                />
                <div className="weight-field">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder={isBodyweight ? '0' : unit === 'lb' ? '135' : '60'}
                    value={set.weight}
                    onChange={(event) => updateSet(set.key, 'weight', event.target.value)}
                    aria-label={
                      isBodyweight
                        ? t('log.setAddedWeightAria', { index: index + 1, unit })
                        : t('log.setWeightAria', { index: index + 1, unit })
                    }
                  />
                  <span>{unit}</span>
                </div>
                <button
                  type="button"
                  className="icon-btn remove-set"
                  onClick={() => removeSet(set.key)}
                  disabled={sets.length === 1}
                  aria-label={t('log.removeSetAria', { index: index + 1 })}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            ))}

            <button type="button" className="add-set-btn" onClick={addSet}>
              <PlusIcon size={16} /> {t('action.addSet')}
            </button>
          </div>

          <label className="field notes-field">
            <span>
              {t('log.notes')} <em>{t('common.optional')}</em>
            </span>
            <textarea
              rows={2}
              placeholder={t('log.notesPlaceholder')}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="session-summary">
            <div>
              <span>{t('log.sessionVolume')}</span>
              <strong>{formatVolume(previewVolume, unit)}</strong>
            </div>
            <div>
              <span>{t('log.sets')}</span>
              <strong>{validSetCount}</strong>
            </div>
            <div>
              <span>{t('common.est1rm')}</span>
              <strong>
                {formatWeight(
                  sets.reduce((best, set) => {
                    const reps = Number(set.reps)
                    if (!Number.isFinite(reps) || reps <= 0) return best
                    const kg = rowLoadKg(set)
                    if (kg <= 0) return best
                    return Math.max(best, kg * (1 + reps / 30))
                  }, 0),
                  unit,
                )}
              </strong>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg">
            <CheckIcon size={18} />
            {editing ? t('action.saveChanges') : t('action.saveWorkout')}
          </button>
          <p className="fineprint save-note">{t('log.saveNote')}</p>
        </form>
      </div>
    </div>
  )
}
