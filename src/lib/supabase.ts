import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in the browser: every table is protected by
// row-level security, and all writes go through checked database functions.
const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const APP_NAME = 'Billuminati'

/** Absolute URL inside the app, respecting the base path the app is deployed under. */
export function appUrl(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}${path.startsWith('/') ? path : '/' + path}`
}

/** Turns a Supabase/Postgres error into a sentence a person can act on. */
export function errText(e: unknown): string {
  if (!e) return 'Something went wrong'
  const m = typeof e === 'string' ? e : (e as { message?: string }).message || 'Something went wrong'
  if (/Invalid login credentials/i.test(m)) return 'Email or password is incorrect.'
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox for the link.'
  if (/User already registered/i.test(m)) return 'An account with this email already exists. Try logging in.'
  if (/rate limit/i.test(m)) return 'Too many emails sent just now. Please wait a few minutes and try again.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'You seem to be offline. Check your connection and try again.'
  return m
}
