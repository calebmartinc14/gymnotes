import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppState,
  Exercise,
  Habit,
  HabitCheck,
  HabitDraft,
  Profile,
  Tab,
  Workout,
} from './types'
import { CalendarPage } from './components/Calendar'
import { Dashboard } from './components/Dashboard'
import { GoalsPage } from './components/Goals'
import { LogWorkout } from './components/LogWorkout'
import { Progress } from './components/Progress'
import { ProfilePage } from './components/Profile'
import { AuthScreen } from './components/AuthScreen'
import { LanguageSwitch } from './components/LanguageSwitch'
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  CloseIcon,
  DumbbellIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  TargetIcon,
  UserIcon,
  WarningIcon,
} from './components/Icons'
import { personalRecordIds, todayISO } from './lib/calc'
import { demoState } from './data/demo'
import {
  emptyState,
  clearLocalAccountCache,
  loadState,
  newId,
  normalizeState,
  readLocalOwner,
  saveState,
  STORAGE_KEY,
  writeLocalOwner,
} from './lib/storage'
import { useI18n } from './lib/i18n'
import { useAuth } from './lib/auth'
import { fetchState, hasData, isSchemaError } from './lib/remote'
import {
  createOperation,
  enqueue,
  enqueueSnapshot,
  flushOutbox,
  isNetworkError,
  pendingFor,
  type SyncPayload,
} from './lib/sync'

interface ToastState {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
  persistent?: boolean
}

const TAB_IDS: Tab[] = ['dashboard', 'log', 'progress', 'calendar', 'goals', 'profile']

interface RouteState {
  tab: Tab
  exerciseId: string | null
}

function parseHash(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const [path, param] = raw.split('/')
  const tab = TAB_IDS.includes(path as Tab) ? (path as Tab) : 'dashboard'
  return { tab, exerciseId: param ? decodeURIComponent(param) : null }
}

function buildHash(tab: Tab, exerciseId: string | null): string {
  if (tab === 'progress' && exerciseId) return `#/progress/${encodeURIComponent(exerciseId)}`
  return `#/${tab}`
}

export default function App() {
  const { t } = useI18n()
  const { available, ready, session, userId, email, showAuth, signOut, requestAuth } = useAuth()
  const tRef = useRef(t)
  tRef.current = t

  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>(() =>
    typeof window === 'undefined' ? 'dashboard' : parseHash(window.location.hash).tab,
  )
  const [progressExercise, setProgressExercise] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : parseHash(window.location.hash).exerciseId,
  )
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [logDate, setLogDate] = useState<string | undefined>()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [dataReady, setDataReady] = useState<boolean>(() => !available)
  const lastUserIdRef = useRef<string | null>(userId)
  const skipCacheWriteRef = useRef(false)
  const toastTimer = useRef<number | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)

  const notify = useCallback(
    (message: string, action?: ToastState['action'], persistent = false) => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      setToast({ id: Date.now(), message, action, persistent })
      if (!persistent) {
        toastTimer.current = window.setTimeout(() => setToast(null), action ? 6500 : 3200)
      }
    },
    [],
  )

  const flushingRef = useRef(false)
  const syncNoticeRef = useRef(false)

  const flush = useCallback(async () => {
    if (!available || !userId || flushingRef.current) return
    if (pendingFor(userId) === 0) return
    flushingRef.current = true
    try {
      const result = await flushOutbox(userId)
      if (!result.error) {
        syncNoticeRef.current = false
        return
      }
      if (syncNoticeRef.current) return
      syncNoticeRef.current = true
      if (isSchemaError(result.error)) {
        notify(tRef.current('toast.syncSchemaRequired'), undefined, true)
      } else if (isNetworkError(result.error)) {
        notify(tRef.current('toast.syncQueued'), undefined, false)
      } else {
        notify(tRef.current('toast.syncError'), undefined, true)
      }
    } finally {
      flushingRef.current = false
    }
  }, [available, userId, notify])

  const schedule = useCallback(
    (payload: SyncPayload) => {
      if (!available || !userId) return
      enqueue(createOperation(userId, payload))
      void flush()
    },
    [available, userId, flush],
  )

  const uploadLocal = useCallback(
    (source: AppState) => {
      setState(source)
      if (userId) {
        writeLocalOwner(userId)
        enqueueSnapshot(userId, source)
        void flush()
      }
      notify(tRef.current('toast.uploaded'))
    },
    [flush, userId, notify],
  )

  // Retry queued writes when the connection returns, on sign-in, and periodically.
  useEffect(() => {
    if (!available || !userId) return
    void flush()
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => {
      if (pendingFor(userId) > 0) void flush()
    }, 20000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [available, userId, flush])

  // Load remote data when a user signs in; fall back to the local cache offline.
  useEffect(() => {
    syncNoticeRef.current = false
    if (!available || !userId) {
      if (available && !ready) return
      if (lastUserIdRef.current) {
        lastUserIdRef.current = null
        skipCacheWriteRef.current = true
        setState(emptyState())
        setEditingWorkout(null)
        clearLocalAccountCache()
      }
      setDataReady(true)
      return
    }
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      skipCacheWriteRef.current = true
      setState(emptyState())
      setEditingWorkout(null)
      clearLocalAccountCache()
    }
    lastUserIdRef.current = userId
    let active = true
    setDataReady(false)
    void (async () => {
      try {
        const remoteState = await fetchState(userId)
        if (!active) return
        const local = loadState()
        const owner = readLocalOwner()
        setState(remoteState)
        writeLocalOwner(userId)
        setDataReady(true)
        if (!hasData(remoteState) && hasData(local) && (!owner || owner === userId)) {
          notify(
            tRef.current('toast.uploadPrompt'),
            { label: tRef.current('action.uploadLocal'), onClick: () => uploadLocal(local) },
            true,
          )
        }
      } catch (error) {
        if (!active) return
        setDataReady(true)
        notify(
          tRef.current(isSchemaError(error) ? 'toast.syncSchemaRequired' : 'toast.syncError'),
          undefined,
          true,
        )
      }
    })()
    return () => {
      active = false
    }
  }, [available, ready, userId, notify, uploadLocal])

  // Keep the local cache in sync so the app still works offline.
  useEffect(() => {
    if (!dataReady) return
    if (skipCacheWriteRef.current) {
      skipCacheWriteRef.current = false
      return
    }
    const ok = saveState(state)
    if (!ok) {
      setStorageWarning(tRef.current('app.storageWarning'))
    } else if (storageWarning) {
      setStorageWarning(null)
    }
  }, [state, dataReady, storageWarning])

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const next = normalizeState(JSON.parse(event.newValue))
          setState(next)
          notify(tRef.current('toast.dataUpdated'), undefined, false)
        } catch {
          // ignore parse errors from other tabs
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [notify])

  useEffect(() => {
    function onHashChange() {
      const route = parseHash(window.location.hash)
      setTab(route.tab)
      setProgressExercise(route.exerciseId)
      setEditingWorkout(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const desired = buildHash(tab, progressExercise)
    if (window.location.hash !== desired) {
      window.location.hash = desired
    }
  }, [tab, progressExercise])

  useEffect(() => {
    const titles: Record<Tab, string> = {
      dashboard: t('title.dashboard'),
      log: t('title.log'),
      progress: t('title.progress'),
      calendar: t('title.calendar'),
      goals: t('title.goals'),
      profile: t('title.profile'),
    }
    document.title = `GymNotes — ${titles[tab]}`
  }, [tab, t])

  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.focus()
  }, [tab])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  function go(next: Tab) {
    if (next === 'progress' && tab !== 'progress') setProgressExercise(null)
    setEditingWorkout(null)
    setTab(next)
  }

  function goProgress(exerciseId?: string) {
    setProgressExercise(exerciseId ?? null)
    setTab('progress')
  }

  function goLog(date?: string) {
    setLogDate(date ?? todayISO())
    go('log')
  }

  function saveWorkout(workout: Workout) {
    const hadPrevious = state.workouts.some((item) => item.exerciseId === workout.exerciseId)
    const pr = personalRecordIds([...state.workouts, workout]).has(workout.id)
    setState((current) => ({ ...current, workouts: [...current.workouts, workout] }))
    setProgressExercise(workout.exerciseId)
    setTab('progress')
    notify(!hadPrevious ? t('toast.firstSession') : pr ? t('toast.newPR') : t('toast.workoutSaved'))
    schedule({ kind: 'saveWorkout', workout })
  }

  function startEdit(workout: Workout) {
    setEditingWorkout(workout)
    setTab('log')
  }

  function updateWorkout(workout: Workout) {
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((item) => (item.id === workout.id ? workout : item)),
    }))
    setEditingWorkout(null)
    setProgressExercise(workout.exerciseId)
    setTab('progress')
    notify(t('toast.workoutUpdated'))
    schedule({ kind: 'saveWorkout', workout })
  }

  function cancelEdit() {
    setEditingWorkout(null)
    setTab('progress')
  }

  function deleteWorkout(id: string) {
    const removed = state.workouts.find((workout) => workout.id === id)
    if (!removed) return
    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id),
    }))
    notify(t('toast.workoutDeleted'), {
      label: t('common.undo'),
      onClick: () => {
        setState((current) => ({
          ...current,
          workouts: [...current.workouts, removed],
        }))
        notify(t('toast.workoutRestored'))
        schedule({ kind: 'saveWorkout', workout: removed })
      },
    })
    schedule({ kind: 'removeWorkout', workoutId: id })
  }

  function addExercise(exercise: Exercise) {
    setState((current) => ({
      ...current,
      customExercises: [...current.customExercises, exercise],
    }))
    schedule({ kind: 'saveExercise', exercise })
  }

  function renameExercise(id: string, name: string, group: Exercise['group']) {
    const updated = { id, name, group, custom: true as const }
    setState((current) => ({
      ...current,
      customExercises: current.customExercises.map((exercise) =>
        exercise.id === id ? { ...exercise, name, group } : exercise,
      ),
    }))
    notify(t('toast.exerciseUpdated'))
    schedule({ kind: 'saveExercise', exercise: updated })
  }

  function deleteExercise(id: string) {
    const used = state.workouts.filter((workout) => workout.exerciseId === id).length
    if (used > 0) {
      const ok = window.confirm(t('confirm.deleteExercise', { count: used }))
      if (!ok) return
    }
    setState((current) => ({
      ...current,
      customExercises: current.customExercises.filter((exercise) => exercise.id !== id),
    }))
    notify(t('toast.exerciseDeleted'))
    schedule({ kind: 'removeExercise', exerciseId: id })
  }

  function saveProfile(profile: Profile) {
    setState((current) => ({ ...current, profile }))
    notify(t('toast.profileUpdated'))
    schedule({ kind: 'saveProfile', profile })
  }

  function addHabit(draft: HabitDraft) {
    const habit: Habit = { ...draft, id: newId('habit'), createdAt: Date.now() }
    setState((current) => ({ ...current, habits: [...current.habits, habit] }))
    notify(t('toast.habitAdded'))
    schedule({ kind: 'saveHabit', habit })
  }

  function updateHabit(habit: Habit) {
    setState((current) => ({
      ...current,
      habits: current.habits.map((item) => (item.id === habit.id ? habit : item)),
    }))
    notify(t('toast.habitUpdated'))
    schedule({ kind: 'saveHabit', habit })
  }

  function deleteHabit(id: string) {
    const habit = state.habits.find((item) => item.id === id)
    if (!habit) return
    if (!window.confirm(t('confirm.deleteHabit', { name: habit.name }))) return
    setState((current) => ({
      ...current,
      habits: current.habits.filter((item) => item.id !== id),
      habitChecks: current.habitChecks.filter((check) => check.habitId !== id),
    }))
    notify(t('toast.habitDeleted'))
    schedule({ kind: 'removeHabit', habitId: id })
  }

  function toggleHabitCheck(habitId: string, date: string) {
    const existing = state.habitChecks.find(
      (check) => check.habitId === habitId && check.date === date,
    )
    if (existing) {
      setState((current) => ({
        ...current,
        habitChecks: current.habitChecks.filter((check) => check.id !== existing.id),
      }))
      schedule({ kind: 'removeHabitCheck', checkId: existing.id })
      return
    }
    const check: HabitCheck = {
      id: newId('check'),
      habitId,
      date,
      createdAt: Date.now(),
    }
    setState((current) => ({ ...current, habitChecks: [...current.habitChecks, check] }))
    schedule({ kind: 'saveHabitCheck', check })
  }

  function importData(next: AppState) {
    setState(next)
    notify(t('toast.backupRestored'))
    if (userId) { enqueueSnapshot(userId, next); void flush() }
  }

  function loadDemo() {
    const demo = demoState()
    setState(demo)
    setProgressExercise('bench-press')
    setTab('dashboard')
    window.scrollTo(0, 0)
    notify(t('toast.demoLoaded'))
    if (userId) { enqueueSnapshot(userId, demo); void flush() }
  }

  function resetAll() {
    const empty = emptyState()
    setState(empty)
    setTab('dashboard')
    setProgressExercise(null)
    notify(t('toast.allDeleted'))
    if (userId) { enqueueSnapshot(userId, empty); void flush() }
  }

  function handleSignOut() {
    void signOut()
  }

  if (showAuth) {
    return <AuthScreen />
  }

  if (!dataReady) {
    return (
      <div className="app-loading">
        <span className="app-loading-mark">
          <DumbbellIcon size={24} />
        </span>
        <span>{t('app.loading')}</span>
      </div>
    )
  }

  const nav: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: <GridIcon size={19} /> },
    { id: 'log', label: t('nav.log'), icon: <PlusIcon size={19} /> },
    { id: 'progress', label: t('nav.progress'), icon: <ChartIcon size={19} /> },
    { id: 'calendar', label: t('nav.calendar'), icon: <CalendarIcon size={19} /> },
    { id: 'goals', label: t('nav.goals'), icon: <TargetIcon size={19} /> },
    { id: 'profile', label: t('nav.profile'), icon: <UserIcon size={19} /> },
  ]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            type="button"
            className="brand"
            onClick={() => go('dashboard')}
            aria-label={t('app.dashboardAria')}
          >
            <span className="brand-mark">
              <DumbbellIcon size={21} />
            </span>
            <span className="brand-word">
              Gym<span>Notes</span>
            </span>
          </button>

          <nav className="main-nav" aria-label={t('app.mainNav')}>
            {nav.map((item) => (
              <button
                type="button"
                key={item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => go(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            <LanguageSwitch />
            <span className="unit-pill">{state.profile.unit}</span>
            {available && session && (
              <div className="account-chip">
                <span className="account-email" title={email ?? ''}>
                  {email}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleSignOut}
                  aria-label={t('action.signOut')}
                  title={t('action.signOut')}
                >
                  <LogOutIcon size={16} />
                </button>
              </div>
            )}
            {available && !session && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={requestAuth}>
                {t('profile.signIn')}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => goLog()}>
              <PlusIcon size={16} />
              {t('action.log')}
            </button>
          </div>
        </div>
      </header>

      {storageWarning && (
        <div className="storage-warning" role="alert" aria-live="assertive">
          <WarningIcon size={18} />
          <span>{storageWarning}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setStorageWarning(null)}
            aria-label={t('common.dismissWarning')}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      <main className="app-main" id="main-content" ref={mainRef} tabIndex={-1}>
        {tab === 'dashboard' && (
          <Dashboard
            state={state}
            onLog={goLog}
            onProgress={goProgress}
            onProfile={() => go('profile')}
            onLoadDemo={loadDemo}
          />
        )}
        <div hidden={tab !== 'log'}>
          <LogWorkout
            state={state}
            initialDate={logDate}
            editing={editingWorkout}
            onSave={saveWorkout}
            onUpdate={updateWorkout}
            onCancelEdit={cancelEdit}
            onAddExercise={addExercise}
            onProfile={() => go('profile')}
          />
        </div>
        {tab === 'progress' && (
          <Progress
            state={state}
            initialExerciseId={progressExercise}
            onDeleteWorkout={deleteWorkout}
            onEditWorkout={startEdit}
            onLog={goLog}
            onProfile={() => go('profile')}
          />
        )}
        {tab === 'calendar' && (
          <CalendarPage state={state} onLog={goLog} onProgress={goProgress} />
        )}
        {tab === 'goals' && (
          <GoalsPage
            state={state}
            onAddHabit={addHabit}
            onUpdateHabit={updateHabit}
            onDeleteHabit={deleteHabit}
            onToggleCheck={toggleHabitCheck}
          />
        )}
        {tab === 'profile' && (
          <ProfilePage
            state={state}
            onSaveProfile={saveProfile}
            onRenameExercise={renameExercise}
            onDeleteExercise={deleteExercise}
            onImport={importData}
            onLoadDemo={loadDemo}
            onReset={resetAll}
            onUploadLocal={() => uploadLocal(loadState())}
            notify={notify}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>
          <DumbbellIcon size={14} /> GymNotes
        </span>
        <span>{t('app.footer')}</span>
      </footer>

      {toast && (
        <div
          className="toast"
          role={toast.persistent ? 'alert' : 'status'}
          aria-live={toast.persistent ? 'assertive' : 'polite'}
          key={toast.id}
        >
          <span className="toast-icon">
            {toast.persistent ? <WarningIcon size={16} /> : <CheckIcon size={16} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.onClick()
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label={t('common.dismissNotification')}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
