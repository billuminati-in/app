import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { APP_NAME, appUrl, errText, supabase } from '../lib/supabase'
import { ErrorNote } from '../components/ui'

type Mode = 'login' | 'signup' | 'forgot'

/** Only allow redirects back into this app. */
export function safeNext(n: string | null) {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/'
}

export default function Login() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null)

  if (session) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // remembered so the confirmation link brings people back to where they were heading (e.g. an invite)
      localStorage.setItem('ss_next', next)
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name.')
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: appUrl('/auth/callback') },
        })
        if (error) throw error
        // When email confirmation is on, there is no session until the link is clicked.
        if (!data.session) setSent('confirm')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/auth/reset') })
        if (error) throw error
        setSent('reset')
      }
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <main className="page auth">
        <p className="brand">{APP_NAME}</p>
        <h1 className="h1">Check your email</h1>
        <p className="muted">
          {sent === 'confirm'
            ? <>We sent a confirmation link to <b>{email}</b>. Open it on this device to finish signing up.</>
            : <>We sent a password reset link to <b>{email}</b>.</>}
        </p>
        <p className="muted small">Can't find it? Check your spam folder.</p>
        <button className="btn btn-ghost" onClick={() => { setSent(null); setMode('login') }}>Back to log in</button>
      </main>
    )
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'
  return (
    <main className="page auth">
      <p className="brand">{APP_NAME}</p>
      <h1 className="h1">{title}</h1>
      <p className="muted">
        {mode === 'forgot' ? "Enter your email and we'll send you a link to set a new password." : 'Split trips, rent and dinners with friends. Everyone sees the same numbers.'}
      </p>
      <form className="stack-16" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <label className="field">
            <span className="label">Your name</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vivek" maxLength={40} required />
          </label>
        )}
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </label>
        {mode !== 'forgot' && (
          <label className="field">
            <span className="label">Password</span>
            <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : ''} required />
          </label>
        )}
        <ErrorNote text={error} />
        <button className="btn btn-primary" disabled={busy || !email || (mode !== 'forgot' && !password)}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
        </button>
      </form>
      <div className="auth-links">
        {mode === 'login' && <>
          <button className="link" onClick={() => { setMode('signup'); setError(null) }}>New here? <b>Create an account</b></button>
          <button className="link muted" onClick={() => { setMode('forgot'); setError(null) }}>Forgot password?</button>
        </>}
        {mode !== 'login' && <button className="link" onClick={() => { setMode('login'); setError(null) }}>Already have an account? <b>Log in</b></button>}
      </div>
    </main>
  )
}
