/* eslint-disable react-refresh/only-export-components -- this module exports the
   auth provider together with its hook. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

export type AuthErrorKey =
  'auth.errInvalid' | 'auth.errExists' | 'auth.errPassword' | 'auth.errEmail' | 'auth.errGeneric'

const LOCAL_MODE_KEY = 'gymnotes:local-mode'

function mapAuthError(message: string): AuthErrorKey {
  const text = message.toLowerCase()
  if (text.includes('invalid login')) return 'auth.errInvalid'
  if (text.includes('already registered') || text.includes('already exists'))
    return 'auth.errExists'
  if (text.includes('password')) return 'auth.errPassword'
  if (text.includes('email')) return 'auth.errEmail'
  return 'auth.errGeneric'
}

function readLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeLocalMode(value: boolean): void {
  try {
    if (value) localStorage.setItem(LOCAL_MODE_KEY, 'true')
    else localStorage.removeItem(LOCAL_MODE_KEY)
  } catch {
    // ignore private-mode / quota errors
  }
}

export interface AuthResult {
  error: AuthErrorKey | null
}

export interface SignUpResult extends AuthResult {
  needsConfirmation: boolean
}

export interface AuthValue {
  available: boolean
  ready: boolean
  session: Session | null
  userId: string | null
  email: string | null
  localMode: boolean
  showAuth: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  continueLocal: () => void
  requestAuth: () => void
}

const AuthContext = createContext<AuthValue>({
  available: false,
  ready: true,
  session: null,
  userId: null,
  email: null,
  localMode: false,
  showAuth: false,
  signIn: async () => ({ error: 'auth.errGeneric' }),
  signUp: async () => ({ error: 'auth.errGeneric', needsConfirmation: false }),
  signOut: async () => {},
  continueLocal: () => {},
  requestAuth: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const available = isSupabaseConfigured
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!available)
  const [localMode, setLocalMode] = useState<boolean>(() => readLocalMode())

  useEffect(() => {
    if (!available || !supabase) return
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setReady(true)
      })
      .catch(() => {
        if (active) setReady(true)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [available])

  const continueLocal = useCallback(() => {
    writeLocalMode(true)
    setLocalMode(true)
  }, [])

  const requestAuth = useCallback(() => {
    writeLocalMode(false)
    setLocalMode(false)
  }, [])

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    if (!supabase) return { error: 'auth.errGeneric' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: mapAuthError(error.message) }
    writeLocalMode(false)
    setLocalMode(false)
    return { error: null }
  }, [])

  const signUp = useCallback<AuthValue['signUp']>(async (email, password) => {
    if (!supabase) return { error: 'auth.errGeneric', needsConfirmation: false }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: mapAuthError(error.message), needsConfirmation: false }
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    writeLocalMode(false)
    setLocalMode(false)
    setSession(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      available,
      ready,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      localMode,
      showAuth: available && ready && !session && !localMode,
      signIn,
      signUp,
      signOut,
      continueLocal,
      requestAuth,
    }),
    [available, ready, session, localMode, signIn, signUp, signOut, continueLocal, requestAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  return useContext(AuthContext)
}
