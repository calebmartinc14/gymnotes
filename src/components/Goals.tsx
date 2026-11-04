import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AppState, Habit, HabitCheck, HabitDraft } from '../types'
import { addDays, formatDate, formatWeekday, todayISO } from '../lib/calc'
import {
  GOALS_HEATMAP_WEEKS,
  HABIT_HEATMAP_WEEKS,
  bestHabitStreak,
  buildCheckIndex,
  buildHeatmap,
  dailyCompletion,
  habitStreak,
  habitWeekCount,
  isHabitDone,
  weekCheckins,
  type HeatmapCell,
} from '../lib/habits'
import { useI18n } from '../lib/i18n'
import {
  CalendarIcon,
  CheckIcon,
  EditIcon,
  FlameIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
} from './Icons'
import { Heatmap, HeatLegend } from './Heatmap'
import { EmptyState, PageHead, StatCard } from './ui'

interface GoalsPageProps {
  state: AppState
  onAddHabit: (draft: HabitDraft) => void
  onUpdateHabit: (habit: Habit) => void
  onDeleteHabit: (id: string) => void
  onToggleCheck: (habitId: string, date: string) => void
}

export function GoalsPage({
  state,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleCheck,
}: GoalsPageProps) {
  const { t } = useI18n()
  const { habits, habitChecks } = state
  const today = todayISO()
  const [adding, setAdding] = useState(false)

  const checkIndex = useMemo(() => buildCheckIndex(habitChecks), [habitChecks])
  const todayCompletion = dailyCompletion(habits, checkIndex, today)
  const bestStreak = bestHabitStreak(habits, habitChecks, today)
  const thisWeek = weekCheckins(habits, habitChecks, today)
  const heatmap = useMemo(
    () => buildHeatmap(habits, habitChecks, GOALS_HEATMAP_WEEKS, today),
    [habits, habitChecks, today],
  )

  function heatLabel(cell: HeatmapCell): string {
    return t('goals.heatCell', {
      done: cell.done,
      total: cell.total,
      date: formatDate(cell.date, 'short'),
    })
  }

  return (
    <div className="page">
      <PageHead
        kicker={t('goals.kicker')}
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        actions={
          <button
            type="button"
            className={adding ? 'btn btn-ghost' : 'btn btn-primary'}
            onClick={() => setAdding((value) => !value)}
          >
            <PlusIcon size={17} />
            {t('goals.addHabit')}
          </button>
        }
      />

      {adding && (
        <section className="card habit-form-card">
          <HabitForm
            submitLabel={t('goals.createHabit')}
            onSubmit={(draft) => {
              onAddHabit(draft)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      {habits.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={<TargetIcon size={24} />}
            title={t('goals.emptyTitle')}
            text={t('goals.emptyText')}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                <PlusIcon size={17} />
                {t('goals.addHabit')}
              </button>
            }
          />
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard
              label={t('goals.activeHabits')}
              value={habits.length}
              hint={t('goals.activeHabitsHint', { count: habits.length })}
              icon={<TargetIcon size={19} />}
              accent
            />
            <StatCard
              label={t('goals.todayDone')}
              value={`${todayCompletion.done}/${todayCompletion.total}`}
              hint={t('goals.todayDoneHint', {
                done: todayCompletion.done,
                total: todayCompletion.total,
              })}
              icon={<CheckIcon size={19} />}
            />
            <StatCard
              label={t('goals.bestStreak')}
              value={
                <>
                  {bestStreak}
                  <span className="stat-unit">
                    {t('goals.bestStreakUnit', { count: bestStreak })}
                  </span>
                </>
              }
              hint={bestStreak > 0 ? t('goals.streak', { count: bestStreak }) : t('goals.streakNone')}
              icon={<FlameIcon size={19} />}
            />
            <StatCard
              label={t('goals.weekCheckins')}
              value={thisWeek}
              hint={t('goals.weekCheckinsHint', { count: thisWeek })}
              icon={<CalendarIcon size={19} />}
            />
          </section>

          <div className="goals-grid">
            <section className="card goals-heatmap-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('goals.consistency')}</span>
                  <h3>{t('goals.consistencyTitle')}</h3>
                </div>
                <HeatLegend less={t('goals.legendLess')} more={t('goals.legendMore')} />
              </div>
              <Heatmap
                grid={heatmap}
                label={heatLabel}
                ariaLabel={t('goals.heatmapAria', { weeks: GOALS_HEATMAP_WEEKS })}
              />
              <p className="fineprint">{t('goals.consistencyText')}</p>
            </section>

            <section className="card goals-today-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('calendar.today')}</span>
                  <h3>{t('goals.todayTitle')}</h3>
                </div>
                <span className="count-badge">{todayCompletion.done}</span>
              </div>
              <p className="fineprint">{formatDate(today, 'long')}</p>
              <div className="goal-today-list">
                {habits.map((habit) => {
                  const done = isHabitDone(checkIndex, habit.id, today)
                  const weekCount = habitWeekCount(habit.id, habitChecks, today)
                  return (
                    <button
                      type="button"
                      key={habit.id}
                      className={`goal-today-row${done ? ' is-done' : ''}`}
                      onClick={() => onToggleCheck(habit.id, today)}
                      aria-pressed={done}
                      aria-label={t(done ? 'goals.uncheckAria' : 'goals.checkAria', {
                        name: habit.name,
                        date: formatDate(today, 'short'),
                      })}
                    >
                      <span className="goal-check-circle">
                        {done && <CheckIcon size={12} />}
                      </span>
                      <span className="goal-today-copy">
                        <strong>{habit.name}</strong>
                        <span>{t('goals.targetPerWeek', { count: habit.targetPerWeek })}</span>
                      </span>
                      <span className="goal-today-week">
                        {t('goals.weekProgress', {
                          done: weekCount,
                          target: habit.targetPerWeek,
                        })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="goals-habits">
            <div className="goals-habits-head">
              <div>
                <span className="card-kicker">{t('goals.yourHabits')}</span>
                <h2>{t('goals.yourHabits')}</h2>
              </div>
              <span className="count-badge">
                {t('goals.habitCount', { count: habits.length })}
              </span>
            </div>
            <div className="habit-grid">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  checks={habitChecks}
                  today={today}
                  onUpdate={onUpdateHabit}
                  onDelete={onDeleteHabit}
                  onToggle={onToggleCheck}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function HabitCard({
  habit,
  checks,
  today,
  onUpdate,
  onDelete,
  onToggle,
}: {
  habit: Habit
  checks: HabitCheck[]
  today: string
  onUpdate: (habit: Habit) => void
  onDelete: (id: string) => void
  onToggle: (habitId: string, date: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState(habit.note)

  useEffect(() => {
    setNoteDraft(habit.note)
  }, [habit.note])

  const doneDates = useMemo(
    () =>
      new Set(checks.filter((check) => check.habitId === habit.id).map((check) => check.date)),
    [checks, habit.id],
  )
  const weekCount = habitWeekCount(habit.id, checks, today)
  const streak = habitStreak(habit.id, checks, today)
  const heatmap = useMemo(
    () => buildHeatmap([habit], checks, HABIT_HEATMAP_WEEKS, today),
    [habit, checks, today],
  )
  const lastDays = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
  const progress = Math.min(100, Math.round((weekCount / habit.targetPerWeek) * 100))

  function heatLabel(cell: HeatmapCell): string {
    return t('goals.heatCell', {
      done: cell.done,
      total: cell.total,
      date: formatDate(cell.date, 'short'),
    })
  }

  if (editing) {
    return (
      <article className="card habit-card">
        <HabitForm
          initial={habit}
          submitLabel={t('goals.saveHabit')}
          onSubmit={(draft) => {
            onUpdate({ ...habit, ...draft })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    )
  }

  return (
    <article className="card habit-card">
      <div className="habit-head">
        <div className="habit-title">
          <span className="habit-icon">
            <TargetIcon size={15} />
          </span>
          <div>
            <strong>{habit.name}</strong>
            <span>{t('goals.targetPerWeek', { count: habit.targetPerWeek })}</span>
          </div>
        </div>
        <div className="habit-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setEditing(true)}
            aria-label={t('goals.editHabit')}
          >
            <EditIcon size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onDelete(habit.id)}
            aria-label={t('goals.deleteHabit')}
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      <div className="habit-week-progress">
        <div className="habit-progress-head">
          <span>{t('goals.thisWeek')}</span>
          <strong>
            {t('goals.weekProgress', { done: weekCount, target: habit.targetPerWeek })}
          </strong>
        </div>
        <div className="habit-progress-track">
          <span className="habit-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="habit-days">
          {lastDays.map((date) => {
            const done = doneDates.has(date)
            return (
              <button
                type="button"
                key={date}
                className={`habit-day${done ? ' is-done' : ''}${date === today ? ' is-today' : ''}`}
                onClick={() => onToggle(habit.id, date)}
                aria-pressed={done}
                aria-label={t(done ? 'goals.uncheckAria' : 'goals.checkAria', {
                  name: habit.name,
                  date: formatDate(date, 'short'),
                })}
              >
                <span>{formatWeekday(date)}</span>
                <strong>{Number(date.slice(8, 10))}</strong>
              </button>
            )
          })}
        </div>
      </div>

      <div className="habit-meta">
        <span>
          <FlameIcon size={13} />
          {streak > 0 ? t('goals.streak', { count: streak }) : t('goals.streakNone')}
        </span>
        <span>
          {formatDate(lastDays[0], 'short')} – {formatDate(today, 'short')}
        </span>
      </div>

      <Heatmap
        grid={heatmap}
        label={heatLabel}
        ariaLabel={t('goals.habitHeatmapAria', { name: habit.name })}
        compact
      />

      <div className="habit-note">
        <div className="habit-note-head">
          <span>{t('goals.notes')}</span>
          <button
            type="button"
            className="text-btn"
            onClick={() => setNoteEditing((value) => !value)}
          >
            {noteEditing
              ? t('action.cancel')
              : habit.note
                ? t('goals.editNote')
                : t('goals.addNote')}
          </button>
        </div>
        {noteEditing ? (
          <div className="habit-note-edit">
            <textarea
              value={noteDraft}
              maxLength={1000}
              placeholder={t('goals.notePlaceholder')}
              aria-label={t('goals.notes')}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onUpdate({ ...habit, note: noteDraft.trim().slice(0, 1000) })
                setNoteEditing(false)
              }}
            >
              {t('goals.saveNote')}
            </button>
          </div>
        ) : habit.note ? (
          <p className="habit-note-text">{habit.note}</p>
        ) : (
          <p className="habit-note-empty">{t('goals.notePlaceholder')}</p>
        )}
      </div>
    </article>
  )
}

function HabitForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Habit
  submitLabel: string
  onSubmit: (draft: HabitDraft) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(initial?.name ?? '')
  const [target, setTarget] = useState(initial?.targetPerWeek ?? 3)
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('goals.errName'))
      return
    }
    onSubmit({
      name: trimmed.slice(0, 60),
      targetPerWeek: target,
      note: note.trim().slice(0, 1000),
    })
  }

  return (
    <form className="habit-form" onSubmit={submit} noValidate>
      <div className="habit-form-head">
        <div>
          <span className="card-kicker">
            {initial ? t('goals.editHabit') : t('goals.addHabit')}
          </span>
          <h3>{initial ? initial.name : t('goals.createHabit')}</h3>
        </div>
      </div>

      <label className="field">
        <span>{t('goals.habitName')}</span>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder={t('goals.habitNamePlaceholder')}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
        />
      </label>

      <div className="field">
        <span>{t('goals.targetLabel')}</span>
        <div className="goal-target-picker" role="group" aria-label={t('goals.targetLabel')}>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <button
              type="button"
              key={value}
              className={target === value ? 'active' : ''}
              aria-pressed={target === value}
              onClick={() => setTarget(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>
          {t('goals.notes')} <em>{t('common.optional')}</em>
        </span>
        <textarea
          value={note}
          maxLength={1000}
          placeholder={t('goals.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="habit-form-actions">
        <button type="submit" className="btn btn-primary btn-sm">
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {t('action.cancel')}
        </button>
      </div>
    </form>
  )
}
