import type { Expense, Member, Settlement } from './types'

export type PersonBalance = { member: Member; paid: number; share: number; net: number }
export type Transfer = { from: Member; to: Member; amount: number }

/**
 * net > 0: the group owes this person (they get back).
 * net < 0: this person owes the group.
 * Paying someone back (a settlement from A to B) moves A up and B down.
 */
export function computeBalances(members: Member[], expenses: Expense[], settlements: Settlement[]): PersonBalance[] {
  const map = new Map<string, PersonBalance>()
  for (const m of members) map.set(m.id, { member: m, paid: 0, share: 0, net: 0 })
  for (const e of expenses) {
    const p = map.get(e.paid_by)
    if (p) p.paid += e.amount
    for (const s of e.splits) {
      const b = map.get(s.member_id)
      if (b) b.share += s.share
    }
  }
  for (const b of map.values()) b.net = b.paid - b.share
  for (const s of settlements) {
    const f = map.get(s.from_member)
    const t = map.get(s.to_member)
    if (f) f.net += s.amount
    if (t) t.net -= s.amount
  }
  return [...map.values()]
}

/** Fewest practical payments: repeatedly match the biggest debtor with the biggest creditor. */
export function simplifyDebts(balances: PersonBalance[]): Transfer[] {
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ m: b.member, amt: -b.net }))
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ m: b.member, amt: b.net }))
  const out: Transfer[] = []
  debtors.sort((a, b) => b.amt - a.amt)
  creditors.sort((a, b) => b.amt - a.amt)
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    if (pay > 0) out.push({ from: debtors[i].m, to: creditors[j].m, amount: pay })
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt === 0) i++
    if (creditors[j].amt === 0) j++
  }
  return out
}
