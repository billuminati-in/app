// Turning an amount + split method into exact per-person shares (in minor units).

export type Method = 'equal' | 'percent' | 'exact'

/** Equal split. Leftover minor units go one each to the first people, so shares always add up. */
export function equalShares(amount: number, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (!ids.length || amount <= 0) return out
  const base = Math.floor(amount / ids.length)
  let rem = amount - base * ids.length
  for (const id of ids) {
    out[id] = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem--
  }
  return out
}

/** Percent split using largest-remainder rounding so the shares add up to the amount exactly. */
export function percentShares(amount: number, pct: Record<string, number>): Record<string, number> {
  const ids = Object.keys(pct)
  const raw = ids.map((id) => ({ id, exact: (amount * (pct[id] || 0)) / 100 }))
  const out: Record<string, number> = {}
  let used = 0
  for (const r of raw) {
    out[r.id] = Math.floor(r.exact)
    used += out[r.id]
  }
  let rem = amount - used
  const order = [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
  for (const r of order) {
    if (rem <= 0) break
    if (pct[r.id] > 0) {
      out[r.id] += 1
      rem--
    }
  }
  return out
}

/** Even percentages for n people, to 2 decimals, totalling exactly 100. */
export function evenPercents(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (!ids.length) return out
  const base = Math.floor(10000 / ids.length)
  let rem = 10000 - base * ids.length
  for (const id of ids) {
    out[id] = (base + (rem > 0 ? 1 : 0)) / 100
    if (rem > 0) rem--
  }
  return out
}
