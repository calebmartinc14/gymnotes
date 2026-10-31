import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { AppState, Exercise, Profile, Sex, Unit } from '../types'
import {
  bmiInfo,
  compareWorkouts,
  formatDate,
  formatVolume,
  formatWeight,
  fromDisplayWeight,
  round,
  toDisplayWeight,
  todayISO,
  totalVolume,
  uniqueTrainingDays,
} from '../lib/calc'
import { normalizeState, validateImport } from '../lib/storage'
import { bmiCategoryLabel, LOCALE_LABELS, LOCALES, muscleLabel, useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import {
  CheckIcon,
  DownloadIcon,
  EditIcon,
  InfoIcon,
  LogOutIcon,
  RulerIcon,
  ScaleIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
} from './Icons'
import { PageHead } from './ui'
import { MUSCLE_GROUPS } from '../data/exercises'
import { LineChart, type ChartPoint } from './Chart'

interface ProfilePageProps {
  state: AppState
  onSaveProfile: (profile: Profile) => void
  onRenameExercise: (id: string, name: string, group: Exercise['group']) => void
  onDeleteExercise: (id: string) => void
  onImport: (state: AppState) => void
  onLoadDemo: () => void
  onReset: () => void
  onUploadLocal: () => void
  notify: (message: string) => void
}

export function ProfilePage({
  state,
  onSaveProfile,
  onRenameExercise,
  onDeleteExercise,
  onImport,
  onLoadDemo,
  onReset,
  onUploadLocal,
  notify,
}: ProfilePageProps) {
  const { t, locale, setLocale } = useI18n()
  const { available, session, email, signOut, requestAuth } = useAuth()
  const { profile, workouts, customExercises } = state
  const [name, setName] = useState(profile.name)
  const [sex, setSex] = useState<Sex>(profile.sex)
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? '')
  const [weight, setWeight] = useState(
    profile.weightKg ? String(round(toDisplayWeight(profile.weightKg, profile.unit), 1)) : '',
  )
  const [unit, setUnit] = useState<Unit>(profile.unit)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(profile.name)
    setSex(profile.sex)
    setAge(profile.age?.toString() ?? '')
    setHeight(profile.heightCm?.toString() ?? '')
    setWeight(
      profile.weightKg ? String(round(toDisplayWeight(profile.weightKg, profile.unit), 1)) : '',
    )
    setUnit(profile.unit)
    setError('')
  }, [profile])

  const volume = totalVolume(workouts)
  const days = uniqueTrainingDays(workouts)
  const previewHeight = height ? Number(height) : null
  const previewWeight = weight ? fromDisplayWeight(Number(weight), unit) : null
  const previewBmi = bmiInfo(previewWeight, previewHeight)

  const bodyweightPoints = useMemo<ChartPoint[]>(() => {
    const byDate = new Map<string, number>()
    for (const workout of [...workouts].sort(compareWorkouts)) {
      if (workout.bodyweightKg && workout.bodyweightKg > 0) {
        byDate.set(workout.date, workout.bodyweightKg)
      }
    }
    return [...byDate.entries()].map(([date, kg]) => ({
      label: formatDate(date, 'short'),
      value: round(toDisplayWeight(kg, unit), 1),
    }))
  }, [workouts, unit])

  function changeUnit(next: Unit) {
    if (next === unit) return
    if (weight.trim()) {
      const numeric = Number(weight)
      if (Number.isFinite(numeric) && numeric > 0) {
        const kg = fromDisplayWeight(numeric, unit)
        setWeight(String(round(toDisplayWeight(kg, next), 2)))
      }
    }
    setUnit(next)
    setError('')
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const parsedAge = age.trim() ? Number(age) : null
    const parsedHeight = height.trim() ? Number(height) : null
    const parsedWeight = weight.trim() ? fromDisplayWeight(Number(weight), unit) : null

    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 10 || parsedAge > 100)) {
      setError(t('profile.errAge'))
      return
    }
    if (
      parsedHeight !== null &&
      (!Number.isFinite(parsedHeight) || parsedHeight < 100 || parsedHeight > 250)
    ) {
      setError(t('profile.errHeight'))
      return
    }
    if (
      parsedWeight !== null &&
      (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 400)
    ) {
      setError(t('profile.errWeight'))
      return
    }

    onSaveProfile({
      name: name.trim().slice(0, 60),
      sex,
      age: parsedAge,
      heightCm: parsedHeight,
      weightKg: parsedWeight === null ? null : round(parsedWeight, 2),
      unit,
    })
    setError('')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gymnotes-backup-${todayISO()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify(t('toast.backupDownloaded'))
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      const validation = validateImport(parsed)

      if (!validation.ok) {
        notify(t('profile.importNotBackup'))
        return
      }

      const next = normalizeState(parsed)

      let details = t('profile.importSummary', {
        workouts: next.workouts.length,
        exercises: next.customExercises.length,
      })
      if (validation.workoutsSkipped > 0)
        details += t('profile.importSkipped', { count: validation.workoutsSkipped })
      if (validation.exercisesSkipped > 0)
        details += t('profile.importSkipped', { count: validation.exercisesSkipped })
      if (validation.profileIssues.length > 0)
        details += t('profile.importProfileIssues', {
          issues: validation.profileIssues.join(', '),
        })
      if (validation.versionMismatch) details += t('profile.importVersionMismatch')

      if (
        workouts.length > 0 &&
        !window.confirm(t('profile.importConfirm', { details, count: workouts.length }))
      ) {
        return
      }
      onImport(next)
      if (
        validation.workoutsSkipped > 0 ||
        validation.exercisesSkipped > 0 ||
        validation.profileIssues.length > 0
      ) {
        notify(
          t('profile.importRestoredSkipped', {
            workouts: validation.workoutsSkipped,
            exercises: validation.exercisesSkipped,
          }),
        )
      }
    } catch {
      notify(t('profile.importReadError'))
    }
  }

  function loadDemo() {
    if (workouts.length > 0 && !window.confirm(t('profile.demoConfirm'))) {
      return
    }
    onLoadDemo()
  }

  function resetAll() {
    if (!window.confirm(t('profile.resetConfirm'))) {
      return
    }
    onReset()
  }

  return (
    <div className="page">
      <PageHead
        kicker={t('profile.kicker')}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      <div className="profile-grid">
        <form className="card profile-form" onSubmit={save} noValidate>
          <div className="card-head">
            <div>
              <span className="card-kicker">{t('profile.aboutYou')}</span>
              <h3>{t('profile.personalDetails')}</h3>
            </div>
            <span className="profile-avatar" aria-hidden="true">
              {(name.trim()[0] ?? 'A').toUpperCase()}
            </span>
          </div>

          <label className="field">
            <span>
              {t('profile.name')} <em>{t('common.optional')}</em>
            </span>
            <input
              type="text"
              placeholder={t('profile.namePlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
          </label>

          <div className="field">
            <span>{t('profile.sex')}</span>
            <div className="segmented sex-segmented" role="group" aria-label={t('profile.sex')}>
              {(
                [
                  ['male', t('sex.male')],
                  ['female', t('sex.female')],
                  ['other', t('sex.other')],
                ] as Array<[Sex, string]>
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={sex === value ? 'active' : ''}
                  aria-pressed={sex === value}
                  onClick={() => setSex(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="field-hint">{t('profile.sexHint')}</p>
          </div>

          <div className="form-divider" />

          <div className="profile-body-grid">
            <label className="field">
              <span>{t('profile.age')}</span>
              <div className="input-suffix">
                <input
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={100}
                  placeholder="29"
                  value={age}
                  onChange={(event) => {
                    setAge(event.target.value)
                    setError('')
                  }}
                />
                <span>{t('profile.yrs')}</span>
              </div>
            </label>

            <label className="field">
              <span>{t('profile.height')}</span>
              <div className="input-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={100}
                  max={250}
                  step="any"
                  placeholder="178"
                  value={height}
                  onChange={(event) => {
                    setHeight(event.target.value)
                    setError('')
                  }}
                />
                <span>{t('common.cm')}</span>
              </div>
            </label>

            <label className="field">
              <span>{t('profile.bodyweight')}</span>
              <div className="input-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={unit === 'lb' ? 55 : 25}
                  max={unit === 'lb' ? 880 : 400}
                  step="any"
                  placeholder={unit === 'lb' ? '172' : '78'}
                  value={weight}
                  onChange={(event) => {
                    setWeight(event.target.value)
                    setError('')
                  }}
                />
                <span>{unit}</span>
              </div>
            </label>
          </div>

          <div className="field">
            <span>{t('profile.weightUnit')}</span>
            <div
              className="segmented unit-segmented"
              role="group"
              aria-label={t('profile.weightUnit')}
            >
              <button
                type="button"
                className={unit === 'kg' ? 'active' : ''}
                aria-pressed={unit === 'kg'}
                onClick={() => changeUnit('kg')}
              >
                {t('profile.kilograms')}
              </button>
              <button
                type="button"
                className={unit === 'lb' ? 'active' : ''}
                aria-pressed={unit === 'lb'}
                onClick={() => changeUnit('lb')}
              >
                {t('profile.pounds')}
              </button>
            </div>
            <p className="field-hint">{t('profile.unitHint')}</p>
          </div>

          <div className="field">
            <span>{t('app.language')}</span>
            <div className="segmented" role="group" aria-label={t('app.language')}>
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={locale === code ? 'active' : ''}
                  aria-pressed={locale === code}
                  onClick={() => setLocale(code)}
                  lang={code}
                >
                  {LOCALE_LABELS[code]}
                </button>
              ))}
            </div>
          </div>

          {previewBmi && (
            <div className="profile-preview">
              <div>
                <span>{t('profile.bmi')}</span>
                <strong>{round(previewBmi.value, 1)}</strong>
                <em>{bmiCategoryLabel(previewBmi.category, t)}</em>
              </div>
              <div>
                <span>{t('profile.bodyweightStatus')}</span>
                <strong>{formatWeight(previewWeight, unit)}</strong>
                <em>
                  {t('profile.previewMeta', {
                    height: previewHeight ?? '',
                    age: Number(age) || '—',
                  })}
                </em>
              </div>
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="profile-form-actions">
            <button type="submit" className="btn btn-primary">
              <CheckIcon size={18} />
              {t('action.saveChanges')}
            </button>
            <p className="fineprint">
              <InfoIcon size={13} /> {t('profile.storedData')}
            </p>
          </div>
        </form>

        <div className="profile-side">
          {available && (
            <section className="card account-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('profile.account')}</span>
                  <h3>
                    {session
                      ? t('profile.accountSignedIn', { email: email ?? '' })
                      : t('profile.signIn')}
                  </h3>
                </div>
                <UserIcon size={18} />
              </div>
              <p className="fineprint">
                {session ? t('profile.accountHint') : t('profile.accountLocalHint')}
              </p>
              <div className="account-actions">
                {session ? (
                  <>
                    <button type="button" className="data-action" onClick={onUploadLocal}>
                      <span className="data-action-icon">
                        <UploadIcon size={18} />
                      </span>
                      <span>
                        <strong>{t('profile.syncLocal')}</strong>
                        <span>{t('profile.syncLocalHint')}</span>
                      </span>
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
                      <LogOutIcon size={16} /> {t('action.signOut')}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={requestAuth}>
                    {t('profile.signIn')}
                  </button>
                )}
              </div>
            </section>
          )}

          {bodyweightPoints.length > 1 && (
            <section className="card bodyweight-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('profile.trend')}</span>
                  <h3>{t('profile.bodyweightOverTime')}</h3>
                </div>
                <ScaleIcon size={18} />
              </div>
              <LineChart
                points={bodyweightPoints}
                height={200}
                color="#7cc4ff"
                formatValue={(value) => formatWeight(fromDisplayWeight(value, unit), unit)}
                formatAxis={(value) => `${Math.round(value)}`}
                emptyLabel={t('profile.bodyweightEmpty')}
                ariaLabel={t('profile.bodyweightChartAria')}
              />
              <p className="fineprint">{t('profile.bodyweightFineprint')}</p>
            </section>
          )}

          <section className="card data-card">
            <div className="card-head">
              <div>
                <span className="card-kicker">{t('profile.yourData')}</span>
                <h3>{t('profile.backupRestore')}</h3>
              </div>
              <span className="data-lock">
                <ScaleIcon size={16} />
              </span>
            </div>

            <div className="data-summary">
              <div>
                <strong>{workouts.length}</strong>
                <span>{t('profile.sessions')}</span>
              </div>
              <div>
                <strong>{days}</strong>
                <span>{t('profile.trainingDays')}</span>
              </div>
              <div>
                <strong>{formatVolume(volume, unit)}</strong>
                <span>{t('profile.volume')}</span>
              </div>
            </div>

            <p className="fineprint">{t('profile.dataFineprint')}</p>

            <div className="data-actions">
              <button type="button" className="data-action" onClick={exportData}>
                <span className="data-action-icon">
                  <DownloadIcon size={18} />
                </span>
                <span>
                  <strong>{t('profile.exportBackup')}</strong>
                  <span>{t('profile.exportBackupHint')}</span>
                </span>
              </button>

              <button
                type="button"
                className="data-action"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="data-action-icon">
                  <UploadIcon size={18} />
                </span>
                <span>
                  <strong>{t('profile.importBackup')}</strong>
                  <span>{t('profile.importBackupHint')}</span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={importData}
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
              />

              <button type="button" className="data-action" onClick={loadDemo}>
                <span className="data-action-icon">
                  <SparklesIcon size={18} />
                </span>
                <span>
                  <strong>{t('profile.loadDemo')}</strong>
                  <span>{t('profile.loadDemoHint')}</span>
                </span>
              </button>
            </div>

            <button type="button" className="danger-btn" onClick={resetAll}>
              <TrashIcon size={16} />
              {t('profile.resetEverything')}
            </button>
          </section>

          <section className="card method-card">
            <div className="card-head">
              <div>
                <span className="card-kicker">{t('profile.theMethod')}</span>
                <h3>{t('profile.howCompared')}</h3>
              </div>
              <InfoIcon size={18} />
            </div>

            <div className="method-list">
              <div className="method-item">
                <span className="method-icon">
                  <ScaleIcon size={17} />
                </span>
                <div>
                  <strong>{t('profile.method1Title')}</strong>
                  <p>{t('profile.method1Text')}</p>
                </div>
              </div>
              <div className="method-item">
                <span className="method-icon">
                  <UserIcon size={17} />
                </span>
                <div>
                  <strong>{t('profile.method2Title')}</strong>
                  <p>{t('profile.method2Text')}</p>
                </div>
              </div>
              <div className="method-item">
                <span className="method-icon">
                  <RulerIcon size={17} />
                </span>
                <div>
                  <strong>{t('profile.method3Title')}</strong>
                  <p>{t('profile.method3Text')}</p>
                </div>
              </div>
            </div>

            <p className="fineprint">{t('profile.methodFineprint')}</p>
          </section>

          {customExercises.length > 0 && (
            <section className="card custom-list-card">
              <div className="card-head">
                <div>
                  <span className="card-kicker">{t('profile.library')}</span>
                  <h3>{t('profile.customExercises')}</h3>
                </div>
                <span className="count-badge">{customExercises.length}</span>
              </div>
              <div className="custom-list">
                {customExercises.map((exercise) => (
                  <CustomExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    onRename={onRenameExercise}
                    onDelete={onDeleteExercise}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomExerciseRow({
  exercise,
  onRename,
  onDelete,
}: {
  exercise: Exercise
  onRename: (id: string, name: string, group: Exercise['group']) => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(exercise.name)
  const [group, setGroup] = useState<Exercise['group']>(exercise.group)

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    onRename(exercise.id, trimmed, group)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="custom-list-row custom-list-row-edit">
        <input
          type="text"
          value={name}
          maxLength={60}
          aria-label={t('log.exerciseNameAria')}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
            if (event.key === 'Escape') setEditing(false)
          }}
        />
        <select
          value={group}
          aria-label={t('log.muscleGroupAria')}
          onChange={(event) => setGroup(event.target.value as Exercise['group'])}
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
          onClick={save}
          disabled={!name.trim()}
        >
          {t('action.save')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
          {t('action.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="custom-list-row">
      <span>
        <strong>{exercise.name}</strong>
        <span>{muscleLabel(exercise.group, t)}</span>
      </span>
      <span className="custom-list-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            setName(exercise.name)
            setGroup(exercise.group)
            setEditing(true)
          }}
          aria-label={t('profile.renameAria', { name: exercise.name })}
        >
          <EditIcon size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onDelete(exercise.id)}
          aria-label={t('profile.deleteAria', { name: exercise.name })}
        >
          <TrashIcon size={15} />
        </button>
      </span>
    </div>
  )
}
