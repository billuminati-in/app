import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useGroup } from '../lib/useGroup'
import { APP_NAME, appUrl, errText, supabase } from '../lib/supabase'
import type { Member } from '../lib/types'
import { Avatar, Confirm, ErrorNote, Spinner, TopBar } from '../components/ui'

export default function Members() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const { session } = useAuth()
  const { data, reload } = useGroup(id)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [removing, setRemoving] = useState<Member | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (window.location.hash === '#invite') document.getElementById('invite')?.scrollIntoView()
  }, [data])

  if (!data) return <Spinner />
  const { group, members } = data
  const me = members.find((m) => m.user_id === session?.user.id)
  const isOwner = me?.role === 'owner'
  const link = appUrl(`/join/${group.invite_code}`)
  const message = `Join "${group.name}" on ${APP_NAME} to split our expenses: ${link}`

  async function run(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    setBusy(false)
    if (error) {
      setError(errText(error))
      return false
    }
    await reload()
    return true
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    if (await run(() => supabase.rpc('add_member', { p_group: id, p_name: newName.trim() }))) setNewName('')
  }

  async function rename(m: Member) {
    if (!editName.trim() || editName.trim() === m.name) return setEditing(null)
    if (await run(() => supabase.from('group_members').update({ name: editName.trim() }).eq('id', m.id))) setEditing(null)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Press and hold the link to copy it.')
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: `Join ${group.name}`, text: `Join "${group.name}" on ${APP_NAME} to split our expenses:`, url: link })
    } catch { /* closed the share sheet */ }
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <main className="page">
      <TopBar title="Members" back={`/g/${id}`} />
      {q.get('created') && <p className="ok" role="status">Group created. Invite your friends below.</p>}

      <section className="section-first" id="invite">
        <h2 className="h2">Invite people</h2>
        <p className="hint">Anyone with this link can join the group after signing up. If you added them by name, they'll pick their name when they join.</p>
        <div className="invite-box">
          <code className="invite-link">{link}</code>
          <button type="button" className="btn btn-soft btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <div className="grid-2 mt-12">
          <a className="btn btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn btn-outline" href={`mailto:?subject=${encodeURIComponent(`Join ${group.name} on ${APP_NAME}`)}&body=${encodeURIComponent(message)}`}>Email</a>
          {canShare && <button type="button" className="btn btn-outline span-2" onClick={nativeShare}>More ways to share…</button>}
        </div>
        {isOwner && <button type="button" className="link muted small mt-12" onClick={() => setResetOpen(true)}>Reset invite link</button>}
      </section>

      <section className="section">
        <h2 className="h2">In this group</h2>
        <div className="list">
          {members.map((m) => (
            <div className="row" key={m.id}>
              <Avatar name={m.name} />
              {editing === m.id ? (
                <form className="grow input-row" onSubmit={(e) => { e.preventDefault(); rename(m) }}>
                  <input className="input input-sm" value={editName} maxLength={40} autoFocus onChange={(e) => setEditName(e.target.value)} aria-label="New name" />
                  <button className="btn btn-soft btn-sm" disabled={busy}>Save</button>
                </form>
              ) : (
                <>
                  <span className="grow">
                    <span className="row-title">{m.name}{m.user_id === session?.user.id ? ' (you)' : ''}</span>
                    <span className="row-sub">{m.role === 'owner' ? 'Owner' : m.user_id ? 'Joined' : "Hasn't joined yet"}</span>
                  </span>
                  {(m.user_id === null || m.user_id === session?.user.id || isOwner) && (
                    <button className="textlink" onClick={() => { setEditing(m.id); setEditName(m.name) }}>Rename</button>
                  )}
                  {m.user_id === null && <button className="textlink danger-text" onClick={() => setRemoving(m)}>Remove</button>}
                </>
              )}
            </div>
          ))}
        </div>
        <form className="input-row mt-12" onSubmit={add}>
          <input className="input" value={newName} maxLength={40} placeholder="Add someone by name" onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-soft" disabled={busy || !newName.trim()}>Add</button>
        </form>
        <ErrorNote text={error} />
      </section>

      <Confirm open={!!removing} title={`Remove ${removing?.name}?`} body="People who are part of an expense can't be removed. Delete or edit those expenses first."
        confirmLabel="Remove" danger busy={busy}
        onConfirm={async () => { if (removing && (await run(() => supabase.rpc('remove_member', { p_member: removing.id })))) setRemoving(null); else setRemoving(null) }}
        onCancel={() => setRemoving(null)} />
      <Confirm open={resetOpen} title="Reset the invite link?" body="The old link will stop working. People already in the group stay in it."
        confirmLabel="Reset link" busy={busy}
        onConfirm={async () => { await run(() => supabase.rpc('reset_invite', { p_group: id })); setResetOpen(false) }}
        onCancel={() => setResetOpen(false)} />
    </main>
  )
}
