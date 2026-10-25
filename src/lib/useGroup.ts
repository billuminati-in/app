import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Expense, Group, Member, Settlement } from './types'

export type GroupData = {
  group: Group
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

// Keeps the last loaded copy of each group so moving between screens is instant.
const cache = new Map<string, GroupData>()

async function fetchGroup(id: string): Promise<GroupData | null> {
  const [g, m, e, s] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).maybeSingle(),
    supabase.from('group_members').select('*').eq('group_id', id).order('created_at'),
    supabase.from('expenses').select('*, splits:expense_splits(member_id, share, percent)').eq('group_id', id)
      .order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('settlements').select('*').eq('group_id', id)
      .order('settled_on', { ascending: false }).order('created_at', { ascending: false }),
  ])
  const err = g.error || m.error || e.error || s.error
  if (err) throw err
  if (!g.data) return null
  const data: GroupData = {
    group: g.data as Group,
    members: (m.data || []) as Member[],
    expenses: (e.data || []) as Expense[],
    settlements: (s.data || []) as Settlement[],
  }
  cache.set(id, data)
  return data
}

/** Loads a group and keeps it live: any change by any member refreshes it. */
export function useGroup(id: string | undefined) {
  const [data, setData] = useState<GroupData | null>(id ? cache.get(id) || null : null)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const d = await fetchGroup(id)
      if (!d) setMissing(true)
      setData(d)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    reload()
    const soon = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(reload, 250)
    }
    const ch = supabase.channel(`group-${id}`)
    for (const table of ['expenses', 'settlements', 'group_members']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `group_id=eq.${id}` }, soon)
    }
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${id}` }, soon)
    ch.subscribe()
    const onFocus = () => document.visibilityState === 'visible' && soon()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onFocus)
      supabase.removeChannel(ch)
    }
  }, [id, reload])

  return { data, loading, error, missing, reload }
}

export function forgetGroup(id: string) {
  cache.delete(id)
}
