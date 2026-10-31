import { useEffect, useMemo, useState } from 'react'
import type { AppState, Workout } from '../types'
import { allExercises, getExercise } from '../data/exercises'
import {
  bmiInfo,
  compareWorkouts,
  formatDate,
  formatRatio,
  formatVolume,
  formatWeekday,
  formatWeight,
  personalRecordIds,
  round,
  setLoadKg,
  standingFor,
  toDisplayWeight,
  workoutMetrics,
  workoutVolume,
} from '../lib/calc'
import { exerciseLabel, levelLabel, useI18n } from '../lib/i18n'
import {
  ArrowRightIcon,
  ChartIcon,
  ChevronDownIcon,
  EditIcon,
  InfoIcon,
  LayersIcon,
  PlusIcon,
  ScaleIcon,
  TargetIcon,
  TrashIcon,
  TrendIcon,
  TrophyIcon,
} from './Icons'
import { LineChart, type ChartPoint } from './Chart'
import { EmptyState, LevelBar, LevelPill, PageHead, StatCard } from './ui'

interface ProgressProps {
  state: AppState
  initialExerciseId?: string | null
  onDeleteWorkout: (id: string) => void
  onEditWorkout: (workout: Workout) => void
  onLog: () => void
  onProfile: () => void
}

type Metric = 'e1rm' | 'volume'

export function Progress({
  state,
  initialExerciseId,
  onDeleteWorkout,
  onEditWorkout,
  onLog,
  onProfile,
}: ProgressProps) {
  const { t } = useI18n()
  const { profile, workouts, customExercises } = state
  const unit = profile.unit

  const options = useMemo(() => {
    const byExercise = new Map<string, { count: number; latest: string }>()
    for (const workout of workouts) {
      const existing = byExercise.get(workout.exerciseId)
      if (!existing) {
        byExercise.set(workout.exerciseId, { count: 1, latest: workout.date })
      } else {
        existing.count += 1
        if (workout.date > existing.latest) existing.latest = workout.date
      }
    }
    return allExercises(customExercises)
      .filter((exercise) => byExercise.has(exercise.id))
      .map((exercise) => ({
        exercise,
        ...byExercise.get(exercise.id)!,
      }))
      .sort((a, b) => b.latest.localeCompare(a.latest))
  }, [customExercises, workouts])

  const latestWorkout = [...workouts].sort(compareWorkouts).at(-1)
  const [selectedId, setSelectedId] = useState(
    initialExerciseId ?? latestWorkout?.exerciseId ?? 'bench-press',
  )
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [relative, setRelative] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (initialExerciseId) setSelectedId(initialExerciseId)
  }, [initialExerciseId])

  useEffect(() => {
    if (!options.some((option) => option.exercise.id === selectedId) && options[0]) {
      setSelectedId(options[0].exercise.id)
    }
  }, [options, selectedId])

  const selected = getExercise(selectedId, customExercises)
  const sessions = useMemo(
    () => workouts.filter((workout) => workout.exerciseId === selectedId).sort(compareWorkouts),
    [selectedId, workouts],
  )

  const sessionData = useMemo(
    () =>
      sessions.map((workout) => ({
        workout,
        metrics: workoutMetrics(workout),
        volume: workoutVolume(workout),
      })),
    [sessions],
  )

  const latest = sessionData.at(-1)
  const best = sessionData.reduce(
    (winner, item) => (!winner || item.metrics.e1rm > winner.metrics.e1rm ? item : winner),
    sessionData[0],
  )
  const topSet = sessionData.reduce(
    (winner, item) =>
      !winner || (item.metrics.topWeight ?? 0) > (winner.metrics.topWeight ?? 0) ? item : winner,
    sessionData[0],
  )
  const totalVolumeAll = sessionData.reduce((total, item) => total + item.volume, 0)
  const totalSets = sessionData.reduce((total, item) => total + item.metrics.setCount, 0)
  const trackedWeeks = new Set(sessions.map((workout) => workout.date.slice(0, 7))).size
  const canRelative =
    profile.weightKg !== null || sessions.some((workout) => workout.bodyweightKg !== null)

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (metric === 'volume') {
      return sessionData.map(({ workout, volume }) => ({
        label: formatDate(workout.date, 'short'),
        value: volume,
        meta: t('log.setCount', { count: workoutMetrics(workout).setCount }),
      }))
    }
    if (relative) {
      return sessionData.flatMap(({ workout, metrics }) => {
        const bodyweight = workout.bodyweightKg ?? profile.weightKg
        if (!bodyweight || metrics.e1rm <= 0) return []
        return [
          {
            label: formatDate(workout.date, 'short'),
            value: metrics.e1rm / bodyweight,
            meta: `${formatWeight(metrics.e1rm, unit)} ${t('common.e1rm')}`,
          },
        ]
      })
    }
    return sessionData.map(({ workout, metrics }) => ({
      label: formatDate(workout.date, 'short'),
      value: metrics.e1rm,
      meta: `${t('log.setCount', { count: metrics.setCount })} · ${formatWeight(
        metrics.topWeight,
        unit,
      )} ${t('progress.topWord')}`,
    }))
  }, [metric, profile.weightKg, relative, sessionData, t, unit])

  const firstPoint = chartPoints[0]
  const lastPoint = chartPoints.at(-1)
  const delta = firstPoint && lastPoint ? lastPoint.value - firstPoint.value : 0
  const deltaPercent =
    firstPoint && firstPoint.value !== 0 ? (delta / firstPoint.value) * 100 : null

  const standard = selected?.standard
  const standing =
    standard && latest && profile.weightKg
      ? standingFor(standard, latest.metrics.e1rm, profile.weightKg, profile.age, profile.sex)
      : null
  const bmi = bmiInfo(profile.weightKg, profile.heightCm)
  const latestRatio = latest && profile.weightKg ? latest.metrics.e1rm / profile.weightKg : null

  const history = [...sessionData].reverse()
  const visibleHistory = showAll ? history : history.slice(0, 6)
  const prIds = useMemo(() => personalRecordIds(workouts), [workouts])

  function chartFormat(value: number): string {
    if (metric === 'volume') return formatVolume(value, unit)
    if (relative) return formatRatio(value)
    return formatWeight(value, unit)
  }

  function chartAxis(value: number): string {
    if (metric === 'volume') {
      const disp = toDisplayWeight(value, unit)
      return disp >= 1000 ? `${round(disp / 1000, 1)}k` : `${Math.round(disp)}`
    }
    if (relative) return `${round(value, 2).toFixed(2)}×`
    const disp = toDisplayWeight(value, unit)
    return `${Math.round(disp)}`
  }

  function chartDelta(): string {
    if (!firstPoint || !lastPoint) return ''
    const sign = delta > 0 ? '+' : ''
    if (metric === 'volume') {
      return `${sign}${formatVolume(delta, unit)}`
    }
    if (relative) return `${sign}${round(delta, 2).toFixed(2)}×`
    return `${sign}${formatWeight(delta, unit)}`
  }

  if (workouts.length === 0) {
    return (
      <div className="page">
        <PageHead
          kicker={t('progress.kicker')}
          title={t('progress.title')}
          subtitle={t('progress.subtitleEmpty')}
        />
        <section className="card">
          <EmptyState
            icon={<ChartIcon size={28} />}
            title={t('progress.emptyTitle')}
            text={t('progress.emptyText')}
            action={
              <button type="button" className="btn btn-primary" onClick={onLog}>
                <PlusIcon size={18} /> {t('action.logFirstWorkout')}
              </button>
            }
          />
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHead
        kicker={t('progress.kicker')}
        title={t('progress.title')}
        subtitle={t('progress.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={onLog}>
            <PlusIcon size={18} /> {t('action.logWorkout')}
          </button>
        }
      />

      <div className="progress-toolbar card">
        <label className="exercise-select">
          <span>{t('progress.exercise')}</span>
          <div className="select-wrap">
            <select
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value)
                setShowAll(false)
              }}
            >
              {options.map((option) => (
                <option key={option.exercise.id} value={option.exercise.id}>
                  {t('progress.optionCount', {
                    name: exerciseLabel(option.exercise, t),
                    count: option.count,
                  })}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={17} />
          </div>
        </label>

        <div className="toolbar-controls">
          <div className="segmented" role="group" aria-label={t('progress.chartMetricAria')}>
            <button
              type="button"
              className={metric === 'e1rm' ? 'active' : ''}
              aria-pressed={metric === 'e1rm'}
              onClick={() => setMetric('e1rm')}
            >
              {t('progress.est1rm')}
            </button>
            <button
              type="button"
              className={metric === 'volume' ? 'active' : ''}
              aria-pressed={metric === 'volume'}
              onClick={() => {
                setMetric('volume')
                setRelative(false)
              }}
            >
              {t('progress.volume')}
            </button>
          </div>

          <label
            className={`relative-toggle${metric === 'volume' || !canRelative ? ' disabled' : ''}`}
            title={canRelative ? t('progress.relativeTitle') : t('progress.relativeTitleLocked')}
          >
            <input
              type="checkbox"
              checked={relative}
              disabled={metric === 'volume' || !canRelative}
              onChange={(event) => setRelative(event.target.checked)}
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span>
              <ScaleIcon size={15} /> {t('progress.relative')}
            </span>
          </label>
        </div>
      </div>

      <section className="stats-grid progress-stats">
        <StatCard
          label={t('progress.bestE1rm')}
          value={formatWeight(best?.metrics.e1rm ?? 0, unit)}
          hint={best ? formatDate(best.workout.date, 'medium') : '—'}
          icon={<TargetIcon size={19} />}
          accent
        />
        <StatCard
          label={t('progress.topSet')}
          value={formatWeight(topSet?.metrics.topWeight ?? 0, unit)}
          hint={
            topSet?.metrics.topWeightSet
              ? t('progress.repsHint', { reps: topSet.metrics.topWeightSet.reps })
              : '—'
          }
          icon={<TrophyIcon size={19} />}
        />
        <StatCard
          label={t('progress.sessions')}
          value={sessions.length}
          hint={t('progress.acrossMonths', { count: trackedWeeks })}
          icon={<ChartIcon size={19} />}
        />
        <StatCard
          label={t('progress.totalVolume')}
          value={formatVolume(totalVolumeAll, unit)}
          hint={t('progress.workingSets', { count: totalSets })}
          icon={<LayersIcon size={19} />}
        />
      </section>

      <section className="card chart-card">
        <div className="card-head chart-head">
          <div>
            <span className="card-kicker">
              {metric === 'volume'
                ? t('progress.kickerVolume')
                : relative
                  ? t('progress.kickerRelative')
                  : t('progress.kickerStrength')}
            </span>
            <h3>{selected ? exerciseLabel(selected, t) : t('progress.exerciseFallback')}</h3>
            <p className="chart-sub">
              {metric === 'volume'
                ? t('progress.subVolume')
                : relative
                  ? t('progress.subRelative')
                  : t('progress.subStrength')}
            </p>
          </div>
          <div className="chart-head-right">
            {standing && <LevelPill level={levelLabel(standing.level, t)} color={standing.color} />}
            {firstPoint && chartPoints.length > 1 && (
              <span className={`trend-chip${delta < 0 ? ' negative' : ''}`}>
                <TrendIcon size={14} />
                {chartDelta()}
                {deltaPercent !== null && (
                  <span className="trend-percent">
                    {deltaPercent > 0 ? '+' : ''}
                    {Math.round(deltaPercent)}%
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <LineChart
          points={chartPoints}
          height={300}
          color={metric === 'volume' ? '#7cc4ff' : '#c8f169'}
          formatValue={chartFormat}
          formatAxis={chartAxis}
          emptyLabel={relative ? t('progress.emptyRelative') : t('progress.emptyWeighted')}
          ariaLabel={t('progress.chartAria', {
            name: selected ? exerciseLabel(selected, t) : t('progress.exerciseFallback'),
            metric: metric === 'volume' ? t('progress.metricVolume') : t('progress.metricE1rm'),
          })}
        />

        <div className="chart-footer">
          <span className="chart-legend">
            <span
              className="legend-dot"
              style={{ backgroundColor: metric === 'volume' ? '#7cc4ff' : '#c8f169' }}
            />
            {metric === 'volume'
              ? t('progress.legendVolume', { unit })
              : relative
                ? t('progress.legendRelative')
                : t('progress.legendStrength', { unit })}
          </span>
          {firstPoint && (
            <span>
              {t('progress.firstLogged', {
                date: formatDate(sessions[0]?.date ?? '', 'medium'),
              })}
              {lastPoint && sessions.length > 1 && (
                <>
                  {t('progress.latestLogged', {
                    date: formatDate(sessions.at(-1)?.date ?? '', 'medium'),
                  })}
                </>
              )}
            </span>
          )}
        </div>
        {metric === 'e1rm' && <p className="fineprint chart-note">{t('progress.epleyNote')}</p>}
      </section>

      <div className="progress-grid">
        <section className="card standards-detail">
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('progress.howYouCompare')}</span>
              <h3>{t('progress.strengthStandard')}</h3>
            </div>
            {standing && <LevelPill level={levelLabel(standing.level, t)} color={standing.color} />}
          </div>

          {!profile.weightKg ? (
            <div className="mini-empty">
              <ScaleIcon size={24} />
              <div>
                <strong>{t('progress.addBodyweight')}</strong>
                <p>{t('progress.addBodyweightText')}</p>
                <button type="button" className="text-btn" onClick={onProfile}>
                  {t('action.completeProfile')} <ArrowRightIcon size={14} />
                </button>
              </div>
            </div>
          ) : standard && standing && latest ? (
            <>
              <div className="standing-hero">
                <div>
                  <strong>{formatRatio(standing.ratio)}</strong>
                  <span>{t('progress.timesBodyweight')}</span>
                </div>
                <div className="standing-hero-side">
                  <span>{t('progress.ageAdjusted')}</span>
                  <strong>{formatRatio(standing.adjustedRatio)}</strong>
                </div>
              </div>

              <LevelBar score={standing.score} color={standing.color} />

              <div className="standing-next">
                {standing.nextLevel ? (
                  <>
                    {t('progress.toReach', {
                      remaining: formatWeight(standing.remainingKg, unit, 1),
                      level: levelLabel(standing.nextLevel, t),
                      ratio: formatRatio(standing.nextRatio ?? 0),
                    })}
                  </>
                ) : (
                  t('progress.eliteReached')
                )}
              </div>

              <div className="standing-meta">
                <div>
                  <span>{t('progress.bodyweight')}</span>
                  <strong>{formatWeight(profile.weightKg, unit)}</strong>
                </div>
                <div>
                  <span>{t('progress.ageFactor')}</span>
                  <strong>
                    {profile.age ?? '—'}
                    {profile.age ? ` · ×${round(standing.ageFactor, 2)}` : ''}
                  </strong>
                </div>
                <div>
                  <span>{t('progress.bmi')}</span>
                  <strong>{bmi ? round(bmi.value, 1) : '—'}</strong>
                </div>
                <div>
                  <span>{t('progress.latestE1rm')}</span>
                  <strong>{formatWeight(latest.metrics.e1rm, unit)}</strong>
                </div>
              </div>

              <p className="fineprint">
                {bmi
                  ? t('progress.bmiFineprint', {
                      height: profile.heightCm ?? '',
                      weight: formatWeight(profile.weightKg, unit),
                      bmi: round(bmi.value, 1),
                    })
                  : ''}
                {t('progress.standardsFineprint')}
              </p>
            </>
          ) : standard && !latest ? (
            <p className="fineprint">{t('progress.logToSee')}</p>
          ) : latest ? (
            <div className="relative-only">
              <div className="standing-hero">
                <div>
                  <strong>{latestRatio ? formatRatio(latestRatio) : '—'}</strong>
                  <span>{t('progress.timesBodyweight')}</span>
                </div>
                <div className="standing-hero-side">
                  <span>{t('progress.latestE1rm')}</span>
                  <strong>{formatWeight(latest.metrics.e1rm, unit)}</strong>
                </div>
              </div>
              <p className="fineprint">{t('progress.bigFiveNote')}</p>
              <button type="button" className="text-btn" onClick={onProfile}>
                {t('action.updateBodyDetails')} <ArrowRightIcon size={14} />
              </button>
            </div>
          ) : (
            <p className="fineprint">{t('progress.noData')}</p>
          )}

          <details className="explainer">
            <summary>
              <InfoIcon size={14} /> {t('progress.howCalculated')}
            </summary>
            <p>{t('progress.howCalculatedText')}</p>
          </details>
        </section>

        <section className="card history-card">
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('progress.everySession')}</span>
              <h3>{t('progress.history')}</h3>
            </div>
            <span className="count-badge">{sessions.length}</span>
          </div>

          <div className="history-list">
            {visibleHistory.map(({ workout, metrics, volume }) => {
              const pr = prIds.has(workout.id)
              return (
                <div className="history-row" key={workout.id}>
                  <div className="history-date">
                    <strong>{formatDate(workout.date, 'short')}</strong>
                    <span>{formatWeekday(workout.date)}</span>
                  </div>
                  <div className="history-sets">
                    <div className="set-chips">
                      {workout.sets.map((set, index) => (
                        <span className="set-chip" key={index}>
                          {round(toDisplayWeight(setLoadKg(set, workout), unit), 1)} × {set.reps}
                        </span>
                      ))}
                    </div>
                    {workout.notes && <p className="history-note">{workout.notes}</p>}
                  </div>
                  <div className="history-metric">
                    <span>{t('common.e1rm')}</span>
                    <strong>{formatWeight(metrics.e1rm, unit)}</strong>
                  </div>
                  <div className="history-metric hide-small">
                    <span>{t('common.volume')}</span>
                    <strong>{formatVolume(volume, unit)}</strong>
                  </div>
                  <div className="history-actions">
                    {pr && (
                      <span className="pr-badge" title={t('common.personalRecord')}>
                        <TrophyIcon size={11} /> {t('common.pr')}
                      </span>
                    )}
                    <button
                      type="button"
                      className="icon-btn edit-btn"
                      onClick={() => onEditWorkout(workout)}
                      aria-label={t('progress.editAria', {
                        name: selected
                          ? exerciseLabel(selected, t)
                          : t('progress.exerciseFallback'),
                        date: formatDate(workout.date, 'medium'),
                      })}
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn delete-btn"
                      onClick={() => onDeleteWorkout(workout.id)}
                      aria-label={t('progress.deleteAria', {
                        name: selected
                          ? exerciseLabel(selected, t)
                          : t('progress.exerciseFallback'),
                        date: formatDate(workout.date, 'medium'),
                      })}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {history.length > 6 && (
            <button
              type="button"
              className="btn btn-ghost btn-block btn-sm history-more"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? t('action.showLess') : t('progress.showAll', { count: history.length })}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
