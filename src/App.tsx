import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, Exercise, Profile, Tab, Workout } from './types'
import { Dashboard } from './components/Dashboard'
import { LogWorkout } from './components/LogWorkout'
import { Progress } from './components/Progress'
import { ProfilePage } from './components/Profile'
import { AuthScreen } from './components/AuthScreen'
import { LanguageSwitch } from './components/LanguageSwitch'
import {
  ChartIcon,
  CheckIcon,
  CloseIcon,
  DumbbellIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  UserIcon,
  WarningIcon,
} from './components/Icons'
import { personalRecordIds } from './lib/calc'
import { demoState } from './data/demo'
import { emptyState, loadState, normalizeState, saveState, STORAGE_KEY } from './lib/storage'
import { useI18n } from './lib/i18n'
import { useAuth } from './lib/auth'
import {
  fetchState,
  hasData,
  removeExercise as removeExerciseRemote,
  removeWorkout as removeWorkoutRemote,
  replaceAll,
  saveExercise as saveExerciseRemote,
  saveProfile as saveProfileRemote,
  saveWorkout as saveWorkoutRemote,
} from './lib/remote'

interface ToastState {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
  persistent?: boolean
}

const TAB_IDS: Tab[] = ['dashboard', 'log', 'progress', 'profile']

/** Which account the local cache belongs to, so it is never offered to another user. */
const LOCAL_OWNER_KEY = 'gymnotes:local-owner'

function readLocalOwner(): string | null {
  try {
    return localStorage.getItem(LOCAL_OWNER_KEY)
  } catch {
    return null
  }
}

function writeLocalOwner(userId: string): void {
  try {
    localStorage.setItem(LOCAL_OWNER_KEY, userId)
  } catch {
    // ignore private-mode / quota errors
  }
}

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
  const { available, session, userId, email, showAuth, signOut, requestAuth } = useAuth()
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
  const [toast, setToast] = useState<ToastState | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [dataReady, setDataReady] = useState<boolean>(() => !available)
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

  const pushRemote = useCallback(
    async (fn: () => Promise<void>) => {
      if (!available || !userId) return
      try {
        await fn()
      } catch {
        notify(tRef.current('toast.syncError'), undefined, true)
      }
    },
    [available, userId, notify],
  )

  const uploadLocal = useCallback(
    (source: AppState) => {
      setState(source)
      if (userId) writeLocalOwner(userId)
      void pushRemote(() => replaceAll(userId as string, source))
      notify(tRef.current('toast.uploaded'))
    },
    [pushRemote, userId, notify],
  )

  // Load remote data when a user signs in; fall back to the local cache offline.
  useEffect(() => {
    if (!available || !userId) {
      setDataReady(true)
      return
    }
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
      } catch {
        if (!active) return
        setDataReady(true)
        notify(tRef.current('toast.syncError'), undefined, true)
      }
    })()
    return () => {
      active = false
    }
  }, [available, userId, notify, uploadLocal])

  // Keep the local cache in sync so the app still works offline.
  useEffect(() => {
    if (!dataReady) return
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

  function saveWorkout(workout: Workout) {
    const hadPrevious = state.workouts.some((item) => item.exerciseId === workout.exerciseId)
    const pr = personalRecordIds([...state.workouts, workout]).has(workout.id)
    setState((current) => ({ ...current, workouts: [...current.workouts, workout] }))
    setProgressExercise(workout.exerciseId)
    setTab('progress')
    notify(!hadPrevious ? t('toast.firstSession') : pr ? t('toast.newPR') : t('toast.workoutSaved'))
    void pushRemote(() => saveWorkoutRemote(userId as string, workout))
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
    void pushRemote(() => saveWorkoutRemote(userId as string, workout))
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
        void pushRemote(() => saveWorkoutRemote(userId as string, removed))
      },
    })
    void pushRemote(() => removeWorkoutRemote(id))
  }

  function addExercise(exercise: Exercise) {
    setState((current) => ({
      ...current,
      customExercises: [...current.customExercises, exercise],
    }))
    void pushRemote(() => saveExerciseRemote(userId as string, exercise))
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
    void pushRemote(() => saveExerciseRemote(userId as string, updated))
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
    void pushRemote(() => removeExerciseRemote(id))
  }

  function saveProfile(profile: Profile) {
    setState((current) => ({ ...current, profile }))
    notify(t('toast.profileUpdated'))
    void pushRemote(() => saveProfileRemote(userId as string, profile))
  }

  function importData(next: AppState) {
    setState(next)
    notify(t('toast.backupRestored'))
    void pushRemote(() => replaceAll(userId as string, next))
  }

  function loadDemo() {
    const demo = demoState()
    setState(demo)
    setProgressExercise('bench-press')
    setTab('dashboard')
    window.scrollTo(0, 0)
    notify(t('toast.demoLoaded'))
    void pushRemote(() => replaceAll(userId as string, demo))
  }

  function resetAll() {
    const empty = emptyState()
    setState(empty)
    setTab('dashboard')
    setProgressExercise(null)
    notify(t('toast.allDeleted'))
    void pushRemote(() => replaceAll(userId as string, empty))
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
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go('log')}>
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
            onLog={() => go('log')}
            onProgress={goProgress}
            onProfile={() => go('profile')}
            onLoadDemo={loadDemo}
          />
        )}
        <div hidden={tab !== 'log'}>
          <LogWorkout
            state={state}
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
            onLog={() => go('log')}
            onProfile={() => go('profile')}
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
