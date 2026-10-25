import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useGroup } from '../lib/useGroup'
import { computeBalances } from '../lib/balances'
import { fmt } from '../lib/money'
import { Avatar, Empty, ErrorNote, Icon, Spinner, TopBar, shortDate } from '../components/ui'

export default function Group() {
  const { id } = useParams()
  const { session } = useAuth()
  const { data, loading, error, missing } = useGroup(id)

  const view = useMemo(() => {
    if (!data) return null
    const names = new Map(data.members.map((m) => [m.id, m.name]))
    const balances = computeBalances(data.members, data.expenses, data.settlements)
    const me = data.members.find((m) => m.user_id === session?.user.id)
    const mine = balances.find((b) => b.member.id === me?.id)
    const owing = balances.filter((b) => b.net < 0).length
    const total = data.expenses.reduce((s, e) => s + e.amount, 0)
    type Item = { kind: 'e' | 's'; date: string; created: string; id: string }
    const feed: Item[] = [
      ...data.expenses.map((e) => ({ kind: 'e' as const, date: e.spent_on, created: e.created_at, id: e.id })),
      ...data.settlements.map((s) => ({ kind: 's' as const, date: s.settled_on, created: s.created_at, id: s.id })),
    ].sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created))
    return { names, mine, owing, total, feed }
  }, [data, session])

  if (loading && !data) return <Spinner />
  if (missing) return (
    <main className="page"><TopBar title="Group" back="/" />
      <Empty title="Group not found" body="It may have been deleted, or you're no longer a member." action={<Link to="/" className="btn btn-primary">Back to groups</Link>} />
    </main>
  )
  if (!data || !view) return <main className="page"><TopBar title="Group" back="/" /><ErrorNote text={error} /></main>

  const { group, members, expenses, settlements } = data
  const cur = group.currency
  const byId = new Map(expenses.map((e) => [e.id, e]))
  const sById = new Map(settlements.map((s) => [s.id, s]))

  return (
    <main className="page">
      <TopBar title={group.name} back="/" right={<Link to={`/g/${group.id}/settings`} className="textlink">Edit</Link>} />
      <ErrorNote text={error} />
      <section className="hero">
        <p className="muted small">Total spent</p>
        <p className="big">{fmt(view.total, cur, true)}</p>
        <p className="muted small">
          {members.length} {members.length === 1 ? 'member' : 'members'} · {view.owing === 0 ? 'all settled' : `${view.owing} ${view.owing === 1 ? 'person owes' : 'people owe'} money`}
        </p>
        {view.mine && view.mine.net !== 0 && (
          <p className={`you ${view.mine.net > 0 ? 'pos' : 'neg'}`}>
            {view.mine.net > 0 ? `You get back ${fmt(view.mine.net, cur, true)}` : `You owe ${fmt(-view.mine.net, cur, true)}`}
          </p>
        )}
      </section>

      <div className="grid-2">
        <Link to={`/g/${group.id}/expense/new`} className="btn btn-primary"><Icon name="plus" size={16} /> Add expense</Link>
        <Link to={`/g/${group.id}/balances`} className="btn btn-outline">Balances</Link>
        <Link to={`/g/${group.id}/settle`} className="btn btn-outline">Settle up</Link>
        <Link to={`/g/${group.id}/members#invite`} className="btn btn-outline">Invite</Link>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Members</h2>
          <Link to={`/g/${group.id}/members`} className="textlink">Manage</Link>
        </div>
        <div className="chips">
          {members.map((m) => (
            <span key={m.id} className={`chip ${m.user_id ? '' : 'chip-pending'}`} title={m.user_id ? 'Joined' : "Hasn't joined yet"}>
              {m.name}{m.user_id === session?.user.id ? ' (you)' : ''}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Recent expenses</h2>
          <Link to={`/g/${group.id}/activity`} className="textlink">Activity</Link>
        </div>
        {view.feed.length === 0 ? (
          <Empty title="No expenses yet" body="Add the first one: who paid, how much, and who it was for." />
        ) : (
          <div className="list">
            {view.feed.map((it) => {
              if (it.kind === 'e') {
                const e = byId.get(it.id)!
                const payer = view.names.get(e.paid_by) || 'Someone'
                const n = e.splits.length
                return (
                  <Link key={e.id} to={`/g/${group.id}/expense/${e.id}`} className="row">
                    <Avatar name={payer} />
                    <span className="grow">
                      <span className="row-title">{e.description}</span>
                      <span className="row-sub">Paid by {payer} · {n === members.length ? `Split between ${n}` : `For ${n} ${n === 1 ? 'person' : 'people'}`}</span>
                    </span>
                    <span className="row-amt">
                      <span className="amt">{fmt(e.amount, cur)}</span>
                      <span className="row-sub">{shortDate(e.spent_on)}</span>
                    </span>
                    <span className="row-chev"><Icon name="chev" /></span>
                  </Link>
                )
              }
              const s = sById.get(it.id)!
              return (
                <Link key={s.id} to={`/g/${group.id}/payment/${s.id}`} className="row row-payment">
                  <span className="avatar avatar-pay" aria-hidden><Icon name="check" size={16} /></span>
                  <span className="grow">
                    <span className="row-title">{view.names.get(s.from_member)} paid {view.names.get(s.to_member)}</span>
                    <span className="row-sub">Settle up{s.note ? ` · ${s.note}` : ''}</span>
                  </span>
                  <span className="row-amt">
                    <span className="amt">{fmt(s.amount, cur)}</span>
                    <span className="row-sub">{shortDate(s.settled_on)}</span>
                  </span>
                  <span className="row-chev"><Icon name="chev" /></span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
