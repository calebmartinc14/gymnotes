import { useMemo, useState } from 'react'
import type { AppState, Workout } from '../types'
import {
  addDays,
  formatDate,
  formatVolume,
  formatWeekday,
  round,
  setLoadKg,
  toDisplayWeight,
  todayISO,
  totalVolume,
  workoutMetrics,
} from '../lib/calc'
import { getExercise } from '../data/exercises'
import {
  buildCheckIndex,
  dailyCompletion,
  isHabitDone,
  sessionLevel,
} from '../lib/habits'
import { exerciseLabel, useI18n } from '../lib/i18n'
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  PlusIcon,
} from './Icons'
import { PageHead } from './ui'

interface CalendarPageProps {
  state: AppState
  onLog: () => void
  onProgress: (exerciseId?: string) => void
}

function pad(value: number): string {
  return `${value}`.padStart(2, '0')
}

function buildMonthCells(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${year}-${pad(month + 1)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function setsSummary(workout: Workout, unit: 'kg' | 'lb'): string {
  return workout.sets
    .filter((set) => set.reps > 0)
    .map((set) => `${round(toDisplayWeight(setLoadKg(set, workout), unit), 1)}×${set.reps}`)
    .join(' · ')
}

export function CalendarPage({ state, onLog, onProgress }: CalendarPageProps) {
  const { t } = useI18n()
  const { profile, workouts, habits, habitChecks, customExercises } = state

  const now = new Date()
  const today = todayISO()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selected, setSelected] = useState(today)
  const monthPrefix = `${cursor.year}-${pad(cursor.month + 1)}`

  const workoutByDate = useMemo(() => {
    const map = new Map<string, Workout[]>()
    for (const workout of workouts) {
      const list = map.get(workout.date)
      if (list) list.push(workout)
      else map.set(workout.date, [workout])
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt)
    return map
  }, [workouts])

  const checkIndex = useMemo(() => buildCheckIndex(habitChecks), [habitChecks])
  const habitIds = useMemo(() => new Set(habits.map((habit) => habit.id)), [habits])
  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month), [cursor])

  const monthWorkouts = useMemo(
    () => workouts.filter((workout) => workout.date.startsWith(monthPrefix)),
    [workouts, monthPrefix],
  )
  const monthVolume = totalVolume(monthWorkouts)
  const monthDays = new Set(monthWorkouts.map((workout) => workout.date)).size
  const monthHabitChecks = habitChecks.filter(
    (check) => check.date.startsWith(monthPrefix) && habitIds.has(check.habitId),
  ).length

  const dayWorkouts = workoutByDate.get(selected) ?? []
  const dayHabits = habits.filter((habit) => isHabitDone(checkIndex, habit.id, selected))

  function moveMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    const nextCursor = { year: next.getFullYear(), month: next.getMonth() }
    setCursor(nextCursor)
    setSelected(`${nextCursor.year}-${pad(nextCursor.month + 1)}-01`)
  }

  function goToday() {
    const todayDate = new Date()
    setCursor({ year: todayDate.getFullYear(), month: todayDate.getMonth() })
    setSelected(today)
  }

  return (
    <div className="page">
      <PageHead
        kicker={t('calendar.kicker')}
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={onLog}>
            <PlusIcon size={17} />
            {t('action.logWorkout')}
          </button>
        }
      />

      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="calendar-toolbar">
            <div className="cal-month">
              <span className="card-kicker">{t('calendar.monthSessions')}</span>
              <h2>{formatDate(`${monthPrefix}-01`, 'month')}</h2>
            </div>
            <div className="cal-nav">
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveMonth(-1)}
                aria-label={t('calendar.previousMonth')}
              >
                <ChevronLeftIcon size={17} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>
                {t('calendar.today')}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveMonth(1)}
                aria-label={t('calendar.nextMonth')}
              >
                <ChevronRightIcon size={17} />
              </button>
            </div>
          </div>

          <div className="cal-weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index}>{formatWeekday(addDays('2024-01-01', index))}</span>
            ))}
          </div>

          <div className="cal-grid">
            {cells.map((date, index) => {
              if (!date) return <span className="cal-cell is-empty" key={`empty-${index}`} />
              const sessions = workoutByDate.get(date)?.length ?? 0
              const completion = dailyCompletion(habits, checkIndex, date)
              const level = sessionLevel(sessions)
              const isToday = date === today
              const isSelected = date === selected
              return (
                <button
                  type="button"
                  key={date}
                  className={`cal-cell cal-level-${level}${isToday ? ' is-today' : ''}${
                    isSelected ? ' is-selected' : ''
                  }`}
                  onClick={() => setSelected(date)}
                  aria-label={t('calendar.dayAria', {
                    date: formatDate(date, 'short'),
                    count: sessions,
                  })}
                  aria-pressed={isSelected}
                >
                  <span className="cal-daynum">{Number(date.slice(8, 10))}</span>
                  {sessions > 0 && <span className="cal-count">{sessions}</span>}
                  {completion.done > 0 && <span className="cal-habit-dot" />}
                </button>
              )
            })}
          </div>

          <div className="cal-legend">
            <span>{t('calendar.legendLess')}</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`heat-cell heat-${level}`} />
            ))}
            <span>{t('calendar.legendMore')}</span>
          </div>

          <div className="cal-summary">
            <div>
              <strong>{monthWorkouts.length}</strong>
              <span>{t('calendar.monthSessions')}</span>
            </div>
            <div>
              <strong>{monthDays}</strong>
              <span>{t('calendar.monthDays')}</span>
            </div>
            <div>
              <strong>{formatVolume(monthVolume, profile.unit)}</strong>
              <span>{t('calendar.monthVolume')}</span>
            </div>
            <div>
              <strong>{monthHabitChecks}</strong>
              <span>{t('calendar.monthHabits')}</span>
            </div>
          </div>
        </section>

        <section className="card calendar-day-card">
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('calendar.dayKicker')}</span>
              <h3>{formatDate(selected, 'long')}</h3>
            </div>
            <span className="count-badge">{dayWorkouts.length}</span>
          </div>

          {dayWorkouts.length === 0 && dayHabits.length === 0 ? (
            <div className="mini-empty">
              <CalendarIcon size={23} />
              <div>
                <strong>{t('calendar.dayEmpty')}</strong>
                <p>{t('calendar.dayEmptyHint')}</p>
              </div>
            </div>
          ) : (
            <div className="cal-day-content">
              {dayWorkouts.length > 0 && (
                <div className="cal-workout-list">
                  <span className="cal-list-label">{t('calendar.workouts')}</span>
                  {dayWorkouts.map((workout) => {
                    const exercise = getExercise(workout.exerciseId, customExercises)
                    return (
                      <button
                        type="button"
                        className="cal-workout-row"
                        key={workout.id}
                        onClick={() => onProgress(workout.exerciseId)}
                      >
                        <span className="cal-workout-icon">
                          <DumbbellIcon size={15} />
                        </span>
                        <span className="cal-workout-main">
                          <strong>
                            {exercise
                              ? exerciseLabel(exercise, t)
                              : t('common.unknownExercise')}
                          </strong>
                          <span>{setsSummary(workout, profile.unit)}</span>
                          {workout.notes && (
                            <em className="cal-workout-note">{workout.notes}</em>
                          )}
                        </span>
                        <span className="cal-workout-metric">
                          {formatVolume(workoutMetrics(workout).volume, profile.unit)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {dayHabits.length > 0 && (
                <div className="cal-habit-list">
                  <span className="cal-list-label">{t('calendar.habitsDone')}</span>
                  {dayHabits.map((habit) => (
                    <div className="cal-habit-row" key={habit.id}>
                      <span className="cal-habit-check">
                        <CheckIcon size={12} />
                      </span>
                      <span className="cal-habit-copy">
                        <strong>{habit.name}</strong>
                        {habit.note && <em>{habit.note}</em>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={onLog}>
            <PlusIcon size={15} />
            {t('calendar.logThisDay')}
          </button>
        </section>
      </div>
    </div>
  )
}
