// Money is always handled as integers in the currency's minor unit (halalas, paise, cents).

const digitCache = new Map<string, number>()

export function fractionDigits(currency: string): number {
  let d = digitCache.get(currency)
  if (d === undefined) {
    try {
      d = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      d = 2
    }
    digitCache.set(currency, d)
  }
  return d
}

/** "12.5" -> 1250 (SAR). Returns null for anything that isn't a valid amount. */
export function toMinor(input: string, currency: string): number | null {
  const s = input.replace(/[,\s]/g, '').trim()
  if (!s) return null
  const d = fractionDigits(currency)
  const re = d > 0 ? new RegExp(`^(\\d+)(?:\\.(\\d{0,${d}}))?$`) : /^(\d+)$/
  const m = s.match(re)
  if (!m) return null
  const whole = parseInt(m[1], 10)
  const frac = d > 0 ? parseInt((m[2] || '').padEnd(d, '0') || '0', 10) : 0
  const v = whole * 10 ** d + frac
  return Number.isSafeInteger(v) ? v : null
}

/** 1250 -> "12.5" for putting back into an input. */
export function toInput(minor: number, currency: string): string {
  const d = fractionDigits(currency)
  if (d === 0) return String(minor)
  const s = (minor / 10 ** d).toFixed(d)
  return s.replace(/\.?0+$/, '')
}

/** 198000 SAR -> "1,980"; 12050 -> "120.50". Whole amounts drop the decimals, like the original app. */
export function fmt(minor: number, currency: string, withCode = false): string {
  const d = fractionDigits(currency)
  const neg = minor < 0
  const abs = Math.abs(minor)
  const whole = abs % 10 ** d === 0
  const n = new Intl.NumberFormat('en', {
    minimumFractionDigits: whole ? 0 : d,
    maximumFractionDigits: d,
  }).format(abs / 10 ** d)
  return `${neg ? '-' : ''}${withCode ? currency + ' ' : ''}${n}`
}

export const CURRENCIES = [
  'SAR', 'INR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'USD', 'EUR', 'GBP',
  'EGP', 'JOD', 'PKR', 'LKR', 'BDT', 'NPR', 'PHP', 'IDR', 'MYR', 'SGD',
  'THB', 'TRY', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'ZAR',
]
