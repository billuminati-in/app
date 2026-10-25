import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { forgetGroup, useGroup } from '../lib/useGroup'
import { errText, supabase } from '../lib/supabase'
import { CURRENCIES } from '../lib/money'
import { Confirm, ErrorNote, Spinner, TopBar } from '../components/ui'

export default function GroupSettings() {
  const { id } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const { data, reload } = useGroup(id)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState<null | 'delete' | 'leave'>(null)

  useEffect(() => {
    if (data) { setName(data.group.name); setCurrency(data.group.currency) }
  }, [data])

  if (!data) return <Spinner />
  const me = data.members.find((m) => m.user_id === session?.user.id)
  const isOwner = me?.role === 'owner'
  const hasExpenses = data.expenses.length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setSaved(false)
    const { error } = await supabase.from('groups').update({ name: name.trim(), currency }).eq('id', id)
    setBusy(false)
    if (error) return setError(errText(error))
    setSaved(true)
    reload()
  }

  async function doDanger() {
    setBusy(true)
    const { error } = confirm === 'delete'
      ? await supabase.from('groups').delete().eq('id', id)
      : await supabase.rpc('leave_group', { p_group: id })
    setBusy(false)
    if (error) { setConfirm(null); return setError(errText(error)) }
    forgetGroup(id!)
    nav('/', { replace: true })
  }

  return (
    <main className="page">
      <TopBar title="Group settings" back={`/g/${id}`} />
      {isOwner ? (
        <form className="stack-16" onSubmit={save}>
          <label className="field">
            <span className="label">Group name</span>
            <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Currency</span>
            <select className="input" value={currency} disabled={hasExpenses} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.includes(currency) ? null : <option>{currency}</option>}
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {hasExpenses && <span className="hint">The currency is locked once expenses are added.</span>}
          </label>
          <ErrorNote text={error} />
          {saved && <p className="ok" role="status">Saved.</p>}
          <button className="btn btn-primary" disabled={busy || !name.trim() || (name.trim() === data.group.name && currency === data.group.currency)}>Save changes</button>
        </form>
      ) : (
        <>
          <p className="muted">Only the group owner can rename the group or change its currency.</p>
          <ErrorNote text={error} />
        </>
      )}
      <section className="section">
        {isOwner
          ? <button className="btn btn-outline danger-text" onClick={() => setConfirm('delete')}>Delete group</button>
          : <button className="btn btn-outline danger-text" onClick={() => setConfirm('leave')}>Leave group</button>}
      </section>
      <Confirm open={confirm === 'delete'} title={`Delete "${data.group.name}"?`}
        body="All expenses and payments in this group will be permanently deleted for everyone. This can't be undone."
        confirmLabel="Delete group" danger busy={busy} onConfirm={doDanger} onCancel={() => setConfirm(null)} />
      <Confirm open={confirm === 'leave'} title={`Leave "${data.group.name}"?`}
        body="Your name and past expenses stay in the group so the totals don't change. You can rejoin with the invite link."
        confirmLabel="Leave group" danger busy={busy} onConfirm={doDanger} onCancel={() => setConfirm(null)} />
    </main>
  )
}
