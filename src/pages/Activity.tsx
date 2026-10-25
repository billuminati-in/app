import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../lib/useGroup'
import { fmt } from '../lib/money'
import type { Activity as Act } from '../lib/types'
import { Empty, Spinner, TopBar } from '../components/ui'

export default function Activity() {
  const { id } = useParams()
  const { data } = useGroup(id)
  const [items, setItems] = useState<Act[] | null>(null)

  useEffect(() => {
    const load = () => supabase.from('activity').select('*').eq('group_id', id).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setItems((data || []) as Act[]))
    load()
    const ch = supabase.channel(`activity-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `group_id=eq.${id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  if (!items || !data) return <Spinner />
  const cur = data.group.currency
  const m = (v: unknown) => fmt(Number(v) || 0, cur, true)

  function text(a: Act) {
    const d = a.data as Record<string, string | number>
    const by = d.by || 'Someone'
    switch (a.kind) {
      case 'group_created': return <><b>{by}</b> created the group</>
      case 'member_added': return <><b>{by}</b> added {d.name}</>
      case 'member_removed': return <><b>{by}</b> removed {d.name}</>
      case 'member_joined': return <><b>{d.name}</b> joined</>
      case 'member_left': return <><b>{d.name}</b> left the group</>
      case 'expense_added': return <><b>{by}</b> added "{d.description}" · {m(d.amount)}</>
      case 'expense_edited': return <><b>{by}</b> edited "{d.description}"{d.old_amount !== d.amount ? <> · {m(d.old_amount)} → {m(d.amount)}</> : ''}</>
      case 'expense_deleted': return <><b>{by}</b> deleted "{d.description}" · {m(d.amount)}</>
      case 'settled': return <><b>{by}</b> recorded {d.from} paid {d.to} · {m(d.amount)}</>
      case 'settlement_deleted': return <><b>{by}</b> deleted a payment from {d.from} to {d.to} · {m(d.amount)}</>
      default: return <>{a.kind}</>
    }
  }

  return (
    <main className="page">
      <TopBar title="Activity" back={`/g/${id}`} />
      {items.length === 0 ? <Empty title="Nothing yet" /> : (
        <ol className="timeline">
          {items.map((a) => (
            <li key={a.id}>
              <p>{text(a)}</p>
              <time className="row-sub" dateTime={a.created_at}>
                {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
