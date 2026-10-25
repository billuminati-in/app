import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useGroup } from '../lib/useGroup'
import { computeBalances, simplifyDebts } from '../lib/balances'
import { errText, supabase } from '../lib/supabase'
import { fmt, toInput, toMinor } from '../lib/money'
import { Confirm, ErrorNote, Spinner, TopBar, shortDate, todayISO } from '../components/ui'

export function SettleUp() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const { data } = useGroup(id)
  const [from, setFrom] = useState(q.get('from') || '')
  const [to, setTo] = useState(q.get('to') || '')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cur = data?.group.currency || 'SAR'
  useEffect(() => {
    const a = q.get('amount')
    if (a && data) setAmountStr(toInput(parseInt(a, 10), data.group.currency))
  }, [q, data])

  if (!data) return <Spinner />
  const transfers = simplifyDebts(computeBalances(data.members, data.expenses, data.settlements))
  const meId = data.members.find((m) => m.user_id === session?.user.id)?.id
  const amount = toMinor(amountStr, cur)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!from || !to) return setError('Pick who paid and who received it.')
    if (from === to) return setError('Pick two different people.')
    if (!amount) return setError('Enter the amount that was paid.')
    setBusy(true)
    const { error } = await supabase.rpc('record_settlement', { p_group: id, p_from: from, p_to: to, p_amount: amount, p_on: date, p_note: note || null })
    setBusy(false)
    if (error) return setError(errText(error))
    nav(`/g/${id}`, { replace: true })
  }

  const label = (mid: string) => {
    const m = data.members.find((x) => x.id === mid)
    return m ? m.name + (mid === meId ? ' (you)' : '') : ''
  }

  return (
    <main className="page page-form">
      <TopBar title="Settle up" back={`/g/${id}`} />
      {transfers.length > 0 && (
        <section className="section-first">
          <h2 className="h2">Suggested</h2>
          <div className="list">
            {transfers.map((t, i) => {
              const on = from === t.from.id && to === t.to.id
              return (
                <button key={i} type="button" className={`row row-btn ${on ? 'row-on' : ''}`}
                  onClick={() => { setFrom(t.from.id); setTo(t.to.id); setAmountStr(toInput(t.amount, cur)); setError(null) }}>
                  <span className="grow row-title">{label(t.from.id)} → {label(t.to.id)}</span>
                  <span className="amt">{fmt(t.amount, cur, true)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {transfers.length === 0 && <p className="muted">Everyone is settled up. You can still record a payment below.</p>}

      <form className="stack-20 section" onSubmit={submit} noValidate>
        <h2 className="h2">Record a payment</h2>
        <label className="field">
          <span className="label">Who paid</span>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Choose…</option>
            {data.members.map((m) => <option key={m.id} value={m.id}>{label(m.id)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Who received it</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose…</option>
            {data.members.filter((m) => m.id !== from).map((m) => <option key={m.id} value={m.id}>{label(m.id)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Amount</span>
          <span className="amount-input amount-input-sm">
            <span className="amount-cur">{cur}</span>
            <input inputMode="decimal" value={amountStr} placeholder="0" onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ''))} aria-label={`Amount in ${cur}`} />
          </span>
        </label>
        <label className="field">
          <span className="label">Date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Note <span className="muted">(optional)</span></span>
          <input className="input" value={note} maxLength={120} placeholder="Bank transfer" onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorNote text={error} />
        <div className="sticky-actions">
          <button className="btn btn-primary" disabled={busy || !from || !to || !amount}>{busy ? 'Saving…' : 'Record payment'}</button>
        </div>
      </form>
    </main>
  )
}

/** Detail of a recorded payment, with delete. */
export function PaymentDetail() {
  const { id, sid } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const { data } = useGroup(id)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!data) return <Spinner />
  const s = data.settlements.find((x) => x.id === sid)
  if (!s) return <main className="page"><TopBar title="Payment" back={`/g/${id}`} /><p className="muted">This payment was deleted.</p></main>
  const name = (mid: string) => data.members.find((m) => m.id === mid)?.name || 'Someone'
  const me = data.members.find((m) => m.user_id === session?.user.id)
  const canDelete = s.created_by === session?.user.id || me?.role === 'owner'
  const by = data.members.find((m) => m.user_id === s.created_by)?.name

  async function remove() {
    setBusy(true)
    const { error } = await supabase.rpc('delete_settlement', { p_id: sid })
    setBusy(false)
    setConfirm(false)
    if (error) return setError(errText(error))
    nav(`/g/${id}`, { replace: true })
  }

  return (
    <main className="page">
      <TopBar title="Payment" back={`/g/${id}`} />
      <section className="hero">
        <p className="muted small">{name(s.from_member)} paid {name(s.to_member)}</p>
        <p className="big">{fmt(s.amount, data.group.currency, true)}</p>
        <p className="muted small">{shortDate(s.settled_on)}{s.note ? ` · ${s.note}` : ''}</p>
        <p className="muted small">Recorded by {by || 'a former member'}</p>
      </section>
      <ErrorNote text={error} />
      {canDelete && <button className="btn btn-outline danger-text" onClick={() => setConfirm(true)}>Delete payment</button>}
      <Confirm open={confirm} title="Delete this payment?" body="Balances will go back to how they were before it was recorded."
        confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setConfirm(false)} />
    </main>
  )
}
