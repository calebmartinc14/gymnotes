import type { AppState, Workout } from '../types'
import { getExercise } from '../data/exercises'
import {
  bmiInfo,
  formatDate,
  formatRatio,
  formatVolume,
  formatWeekday,
  formatWeight,
  personalRecordIds,
  round,
  sessionsThisWeek,
  setLoadKg,
  todayISO,
  toDisplayWeight,
  totalVolume,
  trackedStandards,
  uniqueTrainingDays,
  weekStreak,
  workoutMetrics,
  type TrackedStandard,
} from '../lib/calc'
import { bmiCategoryLabel, exerciseLabel, levelLabel, useI18n } from '../lib/i18n'
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  DumbbellIcon,
  EditIcon,
  FlameIcon,
  InfoIcon,
  LayersIcon,
  PlusIcon,
  RulerIcon,
  ScaleIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
  UserIcon,
} from './Icons'
import { LevelBar, LevelPill, StatCard } from './ui'

interface DashboardProps {
  state: AppState
  onLog: () => void
  onProgress: (exerciseId?: string) => void
  onProfile: () => void
  onLoadDemo: () => void
}

function setsSummary(workout: Workout, unit: 'kg' | 'lb'): string {
  return workout.sets
    .filter((set) => set.reps > 0)
    .map((set) => `${round(toDisplayWeight(setLoadKg(set, workout), unit), 1)}×${set.reps}`)
    .join(' · ')
}

function greetingKey(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'dash.greetingMorning'
  if (hour < 18) return 'dash.greetingAfternoon'
  return 'dash.greetingEvening'
}

export function Dashboard({ state, onLog, onProgress, onProfile, onLoadDemo }: DashboardProps) {
  const { t } = useI18n()
  const { profile, workouts, customExercises } = state
  const unit = profile.unit
  const firstName = profile.name.trim().split(/\s+/)[0] ?? ''
  const sorted = [...workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  )
  const tracked = trackedStandards(workouts, customExercises, profile)
  const score = tracked.length
    ? tracked.reduce((sum, item) => sum + item.standing.score, 0) / tracked.length
    : null
  const volume = totalVolume(workouts)
  const days = uniqueTrainingDays(workouts)
  const streak = weekStreak(workouts)
  const thisWeek = sessionsThisWeek(workouts)
  const bmi = bmiInfo(profile.weightKg, profile.heightCm)
  const recent = sorted.slice(0, 6)
  const prIds = personalRecordIds(workouts)
  const recentPRs = sorted
    .filter((workout) => prIds.has(workout.id))
    .slice(0, 3)
    .map((workout) => ({
      workout,
      exercise: getExercise(workout.exerciseId, customExercises),
      metrics: workoutMetrics(workout),
    }))
  const hasData = workouts.length > 0
  const missingProfile = !profile.age || !profile.heightCm || !profile.weightKg

  const scoreDegrees = score ?? 0
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(100, scoreDegrees) / 100)

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            <span className="live-dot" />
            {formatDate(todayISO(), 'long')}
          </span>
          <h1>
            {firstName ? (
              <>
                {t(greetingKey())}, <span className="accent-text">{firstName}</span>.
              </>
            ) : (
              <>
                {t('dash.heroLead')} <span className="accent-text">{t('dash.heroAccent')}</span>.
              </>
            )}
          </h1>
          <p className="hero-sub">
            {hasData ? (
              <>
                {t('dash.movedPrefix')} <strong>{formatVolume(volume, unit)}</strong>{' '}
                {t('dash.movedConnector')}{' '}
                <strong>{t('dash.sessionsCount', { count: workouts.length })}</strong>
                {t('dash.movedTail')}
              </>
            ) : (
              t('dash.heroEmpty')
            )}
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onLog}>
              <PlusIcon size={18} />
              {t('action.logWorkout')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onProgress(sorted[0]?.exerciseId)}
            >
              {t('action.viewProgress')}
              <ArrowRightIcon size={17} />
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <ScaleIcon size={15} />
              {profile.weightKg ? formatWeight(profile.weightKg, unit) : t('profile.bodyweight')}
            </span>
            <span>
              <RulerIcon size={15} />
              {profile.heightCm ? `${profile.heightCm} ${t('common.cm')}` : t('profile.height')}
            </span>
            <span>
              <UserIcon size={15} />
              {profile.age ? t('profile.years', { count: profile.age }) : t('profile.age')}
            </span>
            <span>
              <DumbbellIcon size={15} />
              {t(`sex.${profile.sex}`)}
            </span>
          </div>
        </div>

        <div className="hero-gauge">
          <svg viewBox="0 0 146 146" className="score-ring" aria-hidden="true">
            <circle cx="73" cy="73" r={radius} className="score-ring-track" />
            <circle
              cx="73"
              cy="73"
              r={radius}
              className="score-ring-value"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 73 73)"
            />
          </svg>
          <div className="score-ring-copy">
            <strong>{score === null ? '—' : Math.round(score)}</strong>
            <span>{t('dash.strengthScore')}</span>
          </div>
          <div className="score-caption">
            {score === null
              ? profile.weightKg
                ? t('dash.scoreLogBig')
                : t('dash.scoreAddBodyweight')
              : t('dash.trackedLifts', { count: tracked.length })}
          </div>
        </div>
      </section>

      {missingProfile && (
        <button type="button" className="setup-banner" onClick={onProfile}>
          <span className="setup-icon">
            <InfoIcon size={18} />
          </span>
          <span>
            <strong>{t('dash.setupTitle')}</strong>
            <span>{t('dash.setupText')}</span>
          </span>
          <span className="setup-cta">
            {t('action.completeProfile')} <ArrowRightIcon size={15} />
          </span>
        </button>
      )}

      {!hasData ? (
        <section className="card onboarding-card">
          <div className="onboarding-head">
            <span className="card-kicker">{t('dash.quickStart')}</span>
            <h2>{t('dash.onboardTitle')}</h2>
            <p>{t('dash.onboardText')}</p>
          </div>
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <span className="step-number">1</span>
              <div>
                <strong>{t('dash.step1Title')}</strong>
                <p>{t('dash.step1Text')}</p>
              </div>
            </div>
            <div className="onboarding-step">
              <span className="step-number">2</span>
              <div>
                <strong>{t('dash.step2Title')}</strong>
                <p>{t('dash.step2Text')}</p>
              </div>
            </div>
            <div className="onboarding-step">
              <span className="step-number">3</span>
              <div>
                <strong>{t('dash.step3Title')}</strong>
                <p>{t('dash.step3Text')}</p>
              </div>
            </div>
          </div>
          <div className="onboarding-actions">
            <button type="button" className="btn btn-primary" onClick={onLog}>
              <PlusIcon size={18} />
              {t('action.logFirstWorkout')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onLoadDemo}>
              <SparklesIcon size={17} />
              {t('action.exploreDemo')}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard
              label={t('dash.statScore')}
              value={
                <>
                  {score === null ? '—' : Math.round(score)}
                  <span className="stat-unit">/100</span>
                </>
              }
              hint={score === null ? t('dash.statScoreHint') : t('dash.statScoreHint2')}
              icon={<TargetIcon size={19} />}
              accent
            />
            <StatCard
              label={t('dash.statVolume')}
              value={formatVolume(volume, unit)}
              hint={t('dash.sessionsLogged', { count: workouts.length })}
              icon={<LayersIcon size={19} />}
            />
            <StatCard
              label={t('dash.statDays')}
              value={days}
              hint={t('dash.loggedExercises', { count: workouts.length })}
              icon={<CalendarIcon size={19} />}
            />
            <StatCard
              label={t('dash.statStreak')}
              value={
                <>
                  {streak}
                  <span className="stat-unit">{t('dash.streakUnit', { count: streak })}</span>
                </>
              }
              hint={t('dash.sessionsThisWeek', { count: thisWeek })}
              icon={<FlameIcon size={19} />}
            />
          </section>

          <div className="dashboard-grid">
            <section className="card standards-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('dash.relativeStrength')}</span>
                  <h3>{t('dash.standards')}</h3>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onProgress(tracked[0]?.exercise.id ?? sorted[0]?.exerciseId)}
                >
                  {t('action.details')} <ArrowRightIcon size={14} />
                </button>
              </div>

              {tracked.length === 0 ? (
                <div className="mini-empty">
                  <TrophyIcon size={24} />
                  <div>
                    <strong>{t('dash.noStandards')}</strong>
                    <p>
                      {profile.weightKg ? t('dash.noStandardsText1') : t('dash.noStandardsText2')}
                    </p>
                    <button type="button" className="text-btn" onClick={onProfile}>
                      {profile.weightKg ? t('action.completeProfile') : t('action.addBodyweight')}{' '}
                      <ArrowRightIcon size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="standard-list">
                  {tracked.slice(0, 4).map((item) => (
                    <StandardRow
                      key={item.exercise.id}
                      item={item}
                      unit={unit}
                      onClick={() => onProgress(item.exercise.id)}
                    />
                  ))}
                  {profile.age === null && <p className="fineprint">{t('dash.addAgeFineprint')}</p>}
                </div>
              )}
            </section>

            <section className="card baseline-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('dash.context')}</span>
                  <h3>{t('dash.bodyBaseline')}</h3>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onProfile}
                  aria-label={t('action.editProfile')}
                >
                  <EditIcon size={17} />
                </button>
              </div>

              <div className="body-grid">
                <div className="body-metric">
                  <span>{t('dash.metricWeight')}</span>
                  <strong>{profile.weightKg ? formatWeight(profile.weightKg, unit) : '—'}</strong>
                </div>
                <div className="body-metric">
                  <span>{t('dash.metricHeight')}</span>
                  <strong>
                    {profile.heightCm ? `${profile.heightCm} ${t('common.cm')}` : '—'}
                  </strong>
                </div>
                <div className="body-metric">
                  <span>{t('dash.metricAge')}</span>
                  <strong>{profile.age ?? '—'}</strong>
                </div>
                <div className="body-metric">
                  <span>{t('dash.metricBmi')}</span>
                  <strong>{bmi ? round(bmi.value, 1) : '—'}</strong>
                </div>
              </div>

              {bmi && (
                <div className="bmi-block">
                  <div className="bmi-head">
                    <span>{bmiCategoryLabel(bmi.category, t)}</span>
                    <span>{t('dash.bmiValue', { value: round(bmi.value, 1) })}</span>
                  </div>
                  <div className="bmi-track">
                    <span
                      className="bmi-marker"
                      style={{
                        left: `${Math.min(97, Math.max(3, ((bmi.value - 15) / 25) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="bmi-labels">
                    <span>15</span>
                    <span>25</span>
                    <span>40</span>
                  </div>
                </div>
              )}

              <div className="baseline-note">
                <InfoIcon size={15} />
                <p>{t('dash.baselineNote')}</p>
              </div>
            </section>
          </div>

          <div className="dashboard-grid">
            <section className="card recent-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('dash.latestActivity')}</span>
                  <h3>{t('dash.recentWorkouts')}</h3>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onLog}>
                  <PlusIcon size={15} /> {t('action.log')}
                </button>
              </div>

              <div className="activity-list">
                {recent.map((workout) => {
                  const exercise = getExercise(workout.exerciseId, customExercises)
                  const metrics = workoutMetrics(workout)
                  const pr = prIds.has(workout.id)
                  return (
                    <button
                      type="button"
                      className="activity-row"
                      key={workout.id}
                      onClick={() => onProgress(workout.exerciseId)}
                    >
                      <span className="activity-date">
                        <strong>
                          {workout.date === todayISO()
                            ? t('common.today')
                            : formatDate(workout.date, 'short')}
                        </strong>
                        <span>{formatWeekday(workout.date)}</span>
                      </span>
                      <span className="activity-main">
                        <span className="activity-name">
                          {exercise ? exerciseLabel(exercise, t) : t('common.unknownExercise')}
                          {pr && (
                            <span className="pr-badge">
                              <TrophyIcon size={11} /> {t('common.pr')}
                            </span>
                          )}
                        </span>
                        <span className="activity-sets">{setsSummary(workout, unit)}</span>
                      </span>
                      <span className="activity-metric">
                        <strong>{formatWeight(metrics.e1rm, unit)}</strong>
                        <span>{t('common.est1rm')}</span>
                      </span>
                      <ChevronDownIcon size={16} className="activity-chevron" />
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="card pr-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('dash.bestEfforts')}</span>
                  <h3>{t('dash.recentPRs')}</h3>
                </div>
                <TrophyIcon size={19} className="gold-icon" />
              </div>

              {recentPRs.length === 0 ? (
                <div className="mini-empty compact">
                  <TrophyIcon size={22} />
                  <div>
                    <strong>{t('dash.prEmptyTitle')}</strong>
                    <p>{t('dash.prEmptyText')}</p>
                  </div>
                </div>
              ) : (
                <div className="pr-list">
                  {recentPRs.map(({ workout, exercise, metrics }) => (
                    <button
                      type="button"
                      className="pr-row"
                      key={workout.id}
                      onClick={() => onProgress(workout.exerciseId)}
                    >
                      <span className="pr-icon">
                        <TrophyIcon size={15} />
                      </span>
                      <span className="pr-copy">
                        <strong>
                          {exercise ? exerciseLabel(exercise, t) : t('common.unknownExercise')}
                        </strong>
                        <span>{formatDate(workout.date, 'short')}</span>
                      </span>
                      <span className="pr-value">
                        {formatWeight(metrics.e1rm, unit)}
                        <span>{t('common.e1rm')}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="pr-footer">
                <ClockIcon size={14} />
                <span>
                  {thisWeek > 0
                    ? t('dash.sessionsThisWeek', { count: thisWeek })
                    : t('dash.noSessionsThisWeek')}
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function StandardRow({
  item,
  unit,
  onClick,
}: {
  item: TrackedStandard
  unit: 'kg' | 'lb'
  onClick: () => void
}) {
  const { t } = useI18n()
  const { standing } = item
  const levelName = (level: string) => levelLabel(level, t)
  return (
    <button type="button" className="standard-row" onClick={onClick}>
      <span className="standard-top">
        <span className="standard-name">
          <strong>{exerciseLabel(item.exercise, t)}</strong>
          <span>
            {t('dash.standardRow', {
              weight: formatWeight(item.e1rm, unit),
              ratio: formatRatio(standing.ratio),
            })}
          </span>
        </span>
        <span className="standard-right">
          <LevelPill level={levelName(standing.level)} color={standing.color} small />
          <strong className="standard-score">{Math.round(standing.score)}</strong>
        </span>
      </span>
      <LevelBar score={standing.score} color={standing.color} />
      <span className="standard-next">
        {standing.nextLevel
          ? t('dash.toNextLevel', {
              remaining: formatWeight(standing.remainingKg, unit, 1),
              level: levelName(standing.nextLevel),
            })
          : t('dash.eliteReached')}
        <span className="standard-chevron">
          <ArrowRightIcon size={13} />
        </span>
      </span>
    </button>
  )
}
