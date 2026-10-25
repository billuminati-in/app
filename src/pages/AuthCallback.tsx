import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errText, supabase } from '../lib/supabase'
import { ErrorNote, Spinner } from '../components/ui'
import { safeNext } from './Login'

/** Landing page for the email confirmation link. supabase-js exchanges the ?code automatically. */
export function AuthCallback() {
  const { session, loading } = useAuth()
  const [waited, setWaited] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const linkError = params.get('error_description')

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 6000)
    return () => clearTimeout(t)
  }, [])

  if (session) {
    const next = safeNext(localStorage.getItem('ss_next'))
    localStorage.removeItem('ss_next')
    return <Navigate to={next} replace />
  }
  if (linkError || (waited && !loading)) {
    return (
      <main className="page auth">
        <h1 className="h1">That link didn't work</h1>
        <p className="muted">{linkError || 'It may have expired, or was opened in a different browser.'} Try logging in; if your email isn't confirmed yet, sign up again to get a fresh link.</p>
        <Link className="btn btn-primary" to="/login">Go to log in</Link>
      </main>
    )
  }
  return <Spinner label="Signing you in" />
}

/** Set a new password after following the reset email. */
export function ResetPassword() {
  const { session, loading } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Spinner />
  if (!session) return <AuthCallback />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(errText(error))
    nav('/', { replace: true })
  }
  return (
    <main className="page auth">
      <h1 className="h1">Set a new password</h1>
      <form className="stack-16" onSubmit={submit}>
        <label className="field">
          <span className="label">New password</span>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
        </label>
        <ErrorNote text={error} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </main>
  )
}
