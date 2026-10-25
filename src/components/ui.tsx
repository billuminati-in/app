import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Icon({ name, size = 18 }: { name: 'back' | 'plus' | 'chev' | 'check' | 'user' | 'share' | 'close'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'back': return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
    case 'chev': return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>
    case 'check': return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    case 'user': return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
    case 'share': return <svg {...p}><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></svg>
    case 'close': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
  }
}

/** Screen header: back arrow, title, optional right-side action. */
export function TopBar({ title, back, right }: { title: string; back?: string | true; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="topbar">
      {back && (
        <button className="iconbtn" aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}>
          <Icon name="back" size={20} />
        </button>
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden>{(name.trim()[0] || '?').toUpperCase()}</span>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="center-fill" role="status"><span className="spinner" /><span className="sr-only">{label}</span></div>
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null
  return <p className="error" role="alert">{text}</p>
}

/** In-app confirmation sheet (instead of the browser's confirm() popup). */
export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="sheet-title" className="sheet-title">{title}</h2>
        {body && <div className="sheet-body">{body}</div>}
        <div className="stack-8">
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  )
}

export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="row">{children}<span className="row-chev"><Icon name="chev" /></span></Link>
}

export function shortDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
