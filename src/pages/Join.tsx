import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { APP_NAME, errText, supabase } from '../lib/supabase'
import { ErrorNote, Spinner } from '../components/ui'

type Invite = {
  group_id: string
  name: string
  currency: string
  member_count: number
  already_member: boolean
  unclaimed: { id: string; name: string }[]
}

export default function Join() {
  const { code } = useParams()
  const { session, loading: authLoading } = useAuth()
  const nav = useNavigate()
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [choice, setChoice] = useState<string>('new')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    supabase.rpc('get_invite', { p_code: code }).then(({ data, error }) => {
      if (error) setError(errText(error))
      setInvite((data as Invite) ?? null)
    })
  }, [code, authLoading, session])

  if (authLoading || invite === undefined) return <Spinner />
  if (invite === null) {
    return (
      <main className="page auth">
        <p className="brand">{APP_NAME}</p>
        <h1 className="h1">This invite link isn't valid</h1>
        <p className="muted">It may have been reset by the group owner. Ask them to send you a new one.</p>
        <ErrorNote text={error} />
        <Link className="btn btn-primary" to="/">Go to {APP_NAME}</Link>
      </main>
    )
  }
  if (invite.already_member) return <Navigate to={`/g/${invite.group_id}`} replace />

  const next = `/join/${code}`

  async function join() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_group', { p_code: code, p_claim: choice === 'new' ? null : choice })
    setBusy(false)
    if (error) return setError(errText(error))
    nav(`/g/${data}`, { replace: true })
  }

  return (
    <main className="page auth">
      <p className="brand">{APP_NAME}</p>
      <p className="muted small">You've been invited to</p>
      <h1 className="h1">{invite.name}</h1>
      <p className="muted">{invite.member_count} {invite.member_count === 1 ? 'member' : 'members'} · {invite.currency}</p>

      {!session ? (
        <div className="stack-12 section">
          <Link className="btn btn-primary" to={`/login?mode=signup&next=${encodeURIComponent(next)}`}>Sign up to join</Link>
          <Link className="btn btn-outline" to={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
        </div>
      ) : (
        <div className="section stack-16">
          {invite.unclaimed.length > 0 && (
            <fieldset className="field">
              <legend className="label">Which one are you?</legend>
              <p className="hint">Pick your name if someone already added you, so you get your past expenses.</p>
              <div className="list">
                {invite.unclaimed.map((u) => (
                  <label key={u.id} className={`row row-btn ${choice === u.id ? 'row-on' : ''}`}>
                    <input type="radio" name="who" value={u.id} checked={choice === u.id} onChange={() => setChoice(u.id)} />
                    <span className="grow row-title">I'm {u.name}</span>
                  </label>
                ))}
                <label className={`row row-btn ${choice === 'new' ? 'row-on' : ''}`}>
                  <input type="radio" name="who" value="new" checked={choice === 'new'} onChange={() => setChoice('new')} />
                  <span className="grow row-title">I'm not on this list</span>
                </label>
              </div>
            </fieldset>
          )}
          <ErrorNote text={error} />
          <button className="btn btn-primary" disabled={busy} onClick={join}>{busy ? 'Joining…' : `Join ${invite.name}`}</button>
        </div>
      )}
    </main>
  )
}
