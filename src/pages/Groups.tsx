import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, errText, supabase } from '../lib/supabase'
import { fmt } from '../lib/money'
import type { GroupSummary } from '../lib/types'
import { Empty, ErrorNote, Icon, Spinner } from '../components/ui'

let cached: GroupSummary[] | null = null

export default function Groups() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      supabase.rpc('my_groups').then(({ data, error }) => {
        if (!alive) return
        if (error) return setError(errText(error))
        cached = data as GroupSummary[]
        setGroups(cached)
      })
    load()
    const onVis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">{APP_NAME}</span>
        <div className="topbar-right">
          <Link to="/account" className="iconbtn" aria-label="Account"><Icon name="user" /></Link>
          <Link to="/new" className="btn btn-soft btn-sm"><Icon name="plus" size={16} /> New</Link>
        </div>
      </header>
      <h1 className="h1">Groups</h1>
      <ErrorNote text={error} />
      {!groups && !error && <Spinner />}
      {groups && groups.length === 0 && (
        <Empty
          title="No groups yet"
          body="Create a group for a trip, your flat or a dinner, then invite friends with a link. If someone invited you, open their link to join."
          action={<Link to="/new" className="btn btn-primary">Create a group</Link>}
        />
      )}
      <div className="stack-12">
        {groups?.map((g) => (
          <Link key={g.id} to={`/g/${g.id}`} className="card card-link">
            <div className="grow">
              <p className="card-title">{g.name}</p>
              <p className="meta">{g.member_count} {g.member_count === 1 ? 'member' : 'members'} · {fmt(g.total, g.currency, true)}</p>
              <p className="meta-2">
                {g.my_balance > 0 && <span className="pos">You get back {fmt(g.my_balance, g.currency, true)}</span>}
                {g.my_balance < 0 && <span className="neg">You owe {fmt(-g.my_balance, g.currency, true)}</span>}
                {g.my_balance === 0 && (g.owing_count === 0 ? 'All settled' : `${g.owing_count} ${g.owing_count === 1 ? 'person owes' : 'people owe'} money`)}
              </p>
            </div>
            <span className="row-chev"><Icon name="chev" /></span>
          </Link>
        ))}
      </div>
    </main>
  )
}
