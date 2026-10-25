import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useGroup } from '../lib/useGroup'
import { computeBalances, simplifyDebts } from '../lib/balances'
import { fmt } from '../lib/money'
import { Avatar, Empty, Icon, Spinner, TopBar } from '../components/ui'

export default function Balances() {
  const { id } = useParams()
  const { session } = useAuth()
  const { data } = useGroup(id)
  if (!data) return <Spinner />
  const cur = data.group.currency
  const balances = computeBalances(data.members, data.expenses, data.settlements)
  const transfers = simplifyDebts(balances)
  const you = (mid: string) => data.members.find((m) => m.id === mid)?.user_id === session?.user.id

  return (
    <main className="page">
      <TopBar title="Balances" back={`/g/${id}`} />
      <section className="section-first">
        <h2 className="h2">Who owes whom</h2>
        {transfers.length === 0 ? (
          <Empty title="Everyone is settled up" />
        ) : (
          <div className="list">
            {transfers.map((t, i) => (
              <Link key={i} className="row" to={`/g/${id}/settle?from=${t.from.id}&to=${t.to.id}&amount=${t.amount}`}>
                <span className="grow row-title">
                  {you(t.from.id) ? 'You owe' : `${t.from.name} owes`} {you(t.to.id) ? 'you' : t.to.name}
                </span>
                <span className="amt">{fmt(t.amount, cur, true)}</span>
                <span className="row-chev"><Icon name="chev" /></span>
              </Link>
            ))}
          </div>
        )}
        {transfers.length > 0 && <p className="hint">Tap a line to record that payment. These are the fewest payments that settle everyone.</p>}
      </section>

      <section className="section">
        <h2 className="h2">Each person</h2>
        <div className="list">
          {balances.map((b) => (
            <div className="row" key={b.member.id}>
              <Avatar name={b.member.name} />
              <span className="grow">
                <span className="row-title">{b.member.name}{you(b.member.id) ? ' (you)' : ''}</span>
                <span className="row-sub">Paid {fmt(b.paid, cur)} · Share {fmt(b.share, cur)}</span>
              </span>
              <span className="row-amt">
                {b.net === 0 ? <span className="muted">Settled</span> : <>
                  <span className={`amt ${b.net > 0 ? 'pos' : 'neg'}`}>{fmt(Math.abs(b.net), cur)}</span>
                  <span className="row-sub">{b.net > 0 ? 'gets back' : 'owes'}</span>
                </>}
              </span>
            </div>
          ))}
        </div>
      </section>
      {transfers.length > 0 && <Link to={`/g/${id}/settle`} className="btn btn-primary">Settle up</Link>}
    </main>
  )
}
