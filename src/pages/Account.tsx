import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errText, supabase } from '../lib/supabase'
import { ErrorNote, TopBar } from '../components/ui'

export default function Account() {
  const { profile, session, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState(profile?.display_name || '')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (profile) setName(profile.display_name) }, [profile])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !session) return
    setBusy(true); setError(null); setMsg(null)
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id)
    setBusy(false)
    if (error) return setError(errText(error))
    await refreshProfile()
    setMsg('Saved. New groups will use this name.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  return (
    <main className="page">
      <TopBar title="Account" back="/" />
      <form className="stack-16" onSubmit={save}>
        <label className="field">
          <span className="label">Your name</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span className="label">Email</span>
          <p className="readonly">{session?.user.email}</p>
        </div>
        <ErrorNote text={error} />
        {msg && <p className="ok" role="status">{msg}</p>}
        <button className="btn btn-primary" disabled={busy || !name.trim() || name.trim() === profile?.display_name}>Save</button>
      </form>
      <div className="section">
        <button className="btn btn-outline" onClick={signOut}>Log out</button>
      </div>
    </main>
  )
}
