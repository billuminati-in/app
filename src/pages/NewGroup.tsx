import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errText, supabase } from '../lib/supabase'
import { CURRENCIES } from '../lib/money'
import { ErrorNote, Icon, TopBar } from '../components/ui'

export default function NewGroup() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(() => localStorage.getItem('ss_currency') || 'SAR')
  const [people, setPeople] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the group a name.')
    setBusy(true)
    setError(null)
    const members = people.map((p) => p.trim()).filter(Boolean)
    const { data, error } = await supabase.rpc('create_group', { p_name: name.trim(), p_currency: currency, p_members: members })
    setBusy(false)
    if (error) return setError(errText(error))
    localStorage.setItem('ss_currency', currency)
    nav(`/g/${data}/members?created=1`, { replace: true })
  }

  return (
    <main className="page">
      <TopBar title="New group" back="/" />
      <form className="stack-20" onSubmit={submit}>
        <label className="field">
          <span className="label">Group name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa Trip" maxLength={60} autoFocus />
        </label>
        <label className="field">
          <span className="label">Currency</span>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="label">Who's in it? <span className="muted">(you're added automatically)</span></span>
          <p className="hint">Add friends by name now so you can log expenses straight away. When they join with the invite link, they'll pick their name.</p>
          <div className="stack-8">
            {people.map((p, i) => (
              <div className="input-row" key={i}>
                <input className="input" value={p} maxLength={40} placeholder={`Friend ${i + 1}`}
                  onChange={(e) => {
                    const next = [...people]
                    next[i] = e.target.value
                    if (i === people.length - 1 && e.target.value) next.push('')
                    setPeople(next)
                  }} />
                {people.length > 1 && p && (
                  <button type="button" className="iconbtn" aria-label={`Remove ${p}`} onClick={() => setPeople(people.filter((_, j) => j !== i))}><Icon name="close" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <ErrorNote text={error} />
        <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create group'}</button>
      </form>
    </main>
  )
}
