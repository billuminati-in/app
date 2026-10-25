import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useGroup } from '../lib/useGroup'
import { errText, supabase } from '../lib/supabase'
import { fmt, toInput, toMinor, fractionDigits } from '../lib/money'
import { equalShares, evenPercents, percentShares, type Method } from '../lib/split'
import { Confirm, ErrorNote, Spinner, TopBar, todayISO } from '../components/ui'

export default function ExpenseForm() {
  const { id: gid, eid } = useParams()
  const isNew = !eid || eid === 'new'
  const nav = useNavigate()
  const { session } = useAuth()
  const { data, loading } = useGroup(gid)

  const [amountStr, setAmountStr] = useState('')
  const [desc, setDesc] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<Method>('equal')
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [pct, setPct] = useState<Record<string, string>>({})
  const [exact, setExact] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const existing = data && !isNew ? data.expenses.find((e) => e.id === eid) : undefined
  const me = data?.members.find((m) => m.user_id === session?.user.id)
  const canEdit = isNew || (!!existing && (existing.created_by === session?.user.id || me?.role === 'owner'))

  // Fill the form once the group has loaded
  useEffect(() => {
    if (!data || ready) return
    const cur = data.group.currency
    if (isNew) {
      setPaidBy(me?.id || data.members[0]?.id || '')
      setIncluded(new Set(data.members.map((m) => m.id)))
      setReady(true)
    } else if (existing) {
      setAmountStr(toInput(existing.amount, cur))
      setDesc(existing.description)
      setPaidBy(existing.paid_by)
      setDate(existing.spent_on)
      setMethod(existing.split_method)
      setIncluded(new Set(existing.splits.map((s) => s.member_id)))
      setPct(Object.fromEntries(existing.splits.map((s) => [s.member_id, s.percent != null ? String(+s.percent) : ''])))
      setExact(Object.fromEntries(existing.splits.map((s) => [s.member_id, toInput(s.share, cur)])))
      setReady(true)
    }
  }, [data, existing, isNew, me, ready])

  const cur = data?.group.currency || 'SAR'
  const amount = toMinor(amountStr, cur)
  const ids = useMemo(() => (data ? data.members.filter((m) => included.has(m.id)).map((m) => m.id) : []), [data, included])

  // Compute shares + a validation message for the current method
  const calc = useMemo(() => {
    const a = amount || 0
    if (method === 'equal') return { shares: equalShares(a, ids), problem: ids.length ? null : 'Pick at least one person.' }
    if (method === 'percent') {
      const p: Record<string, number> = {}
      let total = 0
      for (const id of ids) {
        const v = parseFloat(pct[id] || '0')
        p[id] = isFinite(v) && v >= 0 ? v : 0
        total += p[id]
      }
      total = Math.round(total * 1000) / 1000
      const left = Math.round((100 - total) * 1000) / 1000
      return { shares: percentShares(a, p), problem: !ids.length ? 'Pick at least one person.' : left !== 0 ? (left > 0 ? `${left}% left to assign` : `${-left}% too much`) : null }
    }
    const s: Record<string, number> = {}
    let total = 0
    for (const id of ids) {
      s[id] = toMinor(exact[id] || '0', cur) ?? 0
      total += s[id]
    }
    const left = a - total
    return { shares: s, problem: !ids.length ? 'Pick at least one person.' : left !== 0 ? (left > 0 ? `${fmt(left, cur, true)} left to assign` : `${fmt(-left, cur, true)} too much`) : null }
  }, [amount, method, ids, pct, exact, cur])

  if (loading && !data) return <Spinner />
  if (!data) return null
  if (!isNew && !existing) {
    return <main className="page"><TopBar title="Expense" back={`/g/${gid}`} /><p className="muted">This expense was deleted.</p></main>
  }

  function toggle(id: string) {
    const next = new Set(included)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIncluded(next)
  }

  function switchMethod(m: Method) {
    setMethod(m)
    if (m === 'percent' && ids.every((id) => !pct[id])) {
      const even = evenPercents(ids)
      setPct(Object.fromEntries(ids.map((id) => [id, String(even[id])])))
    }
    if (m === 'exact' && amount && ids.every((id) => !exact[id])) {
      const eq = equalShares(amount, ids)
      setExact(Object.fromEntries(ids.map((id) => [id, toInput(eq[id], cur)])))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!amount) return setError(`Enter an amount, like 120${fractionDigits(cur) ? '.50' : ''}.`)
    if (!desc.trim()) return setError('Add a short description, like "Dinner".')
    if (calc.problem) return setError(calc.problem)
    setBusy(true)
    setError(null)
    const splits = ids.map((id) => ({
      member_id: id,
      share: calc.shares[id] || 0,
      percent: method === 'percent' ? parseFloat(pct[id] || '0') : null,
    }))
    const { error } = await supabase.rpc('save_expense', {
      p_group: gid, p_id: isNew ? null : eid, p_description: desc.trim(), p_amount: amount,
      p_paid_by: paidBy, p_method: method, p_spent_on: date, p_splits: splits,
    })
    setBusy(false)
    if (error) return setError(errText(error))
    nav(`/g/${gid}`, { replace: true })
  }

  async function remove() {
    setBusy(true)
    const { error } = await supabase.rpc('delete_expense', { p_id: eid })
    setBusy(false)
    setConfirmDel(false)
    if (error) return setError(errText(error))
    nav(`/g/${gid}`, { replace: true })
  }

  const addedBy = existing && data.members.find((m) => m.user_id === existing.created_by)?.name
  const ro = !canEdit

  return (
    <main className="page page-form">
      <TopBar title={isNew ? 'Add expense' : ro ? 'Expense' : 'Edit expense'} back={`/g/${gid}`} />
      <form className="stack-20" onSubmit={submit} noValidate>
        <label className="field">
          <span className="label">Amount</span>
          <span className="amount-input">
            <span className="amount-cur">{cur}</span>
            <input inputMode="decimal" autoComplete="off" placeholder={fractionDigits(cur) ? '0.00' : '0'} value={amountStr} disabled={ro}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ''))} autoFocus={isNew} aria-label={`Amount in ${cur}`} />
          </span>
        </label>
        <label className="field">
          <span className="label">Description</span>
          <input className="input" value={desc} maxLength={80} placeholder="Dinner" disabled={ro} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Paid by</span>
          <select className="input" value={paidBy} disabled={ro} onChange={(e) => setPaidBy(e.target.value)}>
            {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.user_id === session?.user.id ? ' (you)' : ''}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="label">Split between {ids.length === data.members.length ? `everyone (${ids.length})` : `${ids.length} of ${data.members.length}`}</span>
          <div className="chips">
            {data.members.map((m) => (
              <button type="button" key={m.id} disabled={ro} aria-pressed={included.has(m.id)}
                className={`chip chip-toggle ${included.has(m.id) ? 'on' : ''}`} onClick={() => toggle(m.id)}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">Date</span>
          <input className="input" type="date" value={date} disabled={ro} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field">
          <span className="label">Split method</span>
          <div className="segmented" role="radiogroup" aria-label="Split method">
            {(['equal', 'percent', 'exact'] as Method[]).map((m) => (
              <button type="button" role="radio" aria-checked={method === m} key={m} disabled={ro}
                className={method === m ? 'on' : ''} onClick={() => switchMethod(m)}>
                {m === 'equal' ? 'Equal' : m === 'percent' ? 'Percent' : 'Exact'}
              </button>
            ))}
          </div>
          <div className="split-list">
            {data.members.filter((m) => included.has(m.id)).map((m) => (
              <div className="split-row" key={m.id}>
                <span className="grow">{m.name}</span>
                {method === 'percent' && (
                  <span className="mini-input">
                    <input inputMode="decimal" value={pct[m.id] ?? ''} disabled={ro} aria-label={`${m.name} percent`}
                      onChange={(e) => setPct({ ...pct, [m.id]: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />%
                  </span>
                )}
                {method === 'exact' ? (
                  <span className="mini-input">
                    <input inputMode="decimal" value={exact[m.id] ?? ''} disabled={ro} aria-label={`${m.name} amount`}
                      onChange={(e) => setExact({ ...exact, [m.id]: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="0" />
                  </span>
                ) : (
                  <span className="split-amt">{fmt(calc.shares[m.id] || 0, cur)}</span>
                )}
              </div>
            ))}
            {amount && calc.problem && <p className="split-problem" role="status">{calc.problem}</p>}
          </div>
        </div>
        {existing && <p className="muted small">Added by {addedBy || 'a former member'} · {new Date(existing.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{existing.updated_at !== existing.created_at ? ' · edited' : ''}</p>}
        {ro && <p className="hint">Only the person who added this expense, or the group owner, can change it.</p>}
        <ErrorNote text={error} />
        {!ro && (
          <div className="sticky-actions">
            <button className="btn btn-primary" disabled={busy || !amount || !desc.trim() || !!calc.problem}>{busy ? 'Saving…' : 'Save expense'}</button>
            {!isNew && <button type="button" className="btn btn-ghost danger-text" onClick={() => setConfirmDel(true)}>Delete expense</button>}
          </div>
        )}
      </form>
      <Confirm open={confirmDel} title="Delete this expense?" body={`"${desc}" will be removed for everyone in the group, and balances will update.`}
        confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setConfirmDel(false)} />
    </main>
  )
}
