// Item 3: turn the raw inward `status` into the business label + colour the dashboard shows.
// "approved" stock has cleared approval and is real inventory ("Stock Inward"); "pending" is still
// awaiting approval ("Pending Approval"). Both states stay visible everywhere — this only relabels.

export type StatusTone = 'emerald' | 'amber' | 'slate'

export interface InwardStatusMeta {
  label: string
  tone: StatusTone
  /** Tailwind classes for a chip background + text in this tone. */
  chipClass: string
}

const TONE_CHIP: Record<StatusTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

/** One bucket of inward totals: distinct transaction count + summed net/gross/value. */
export interface StatusBucket {
  count: number
  net: number
  gross: number
  value: number
}

export interface InwardStatusSplit {
  all: StatusBucket
  pending: StatusBucket
  stock: StatusBucket
}

interface SplittableRecord {
  transaction_no?: string
  status?: string | null
  net_weight?: number
  total_weight?: number
  total_amount?: number
}

// Item 3: split inward records into the all / pending / stock buckets that feed the dashboard's
// non-destructive breakdown. `all` always counts EVERY record (pending stays in the headline);
// `stock` is everything not pending. Because a transaction has a single status, the pending and
// stock buckets partition `all` exactly, so stock + pending === all by construction.
export function inwardStatusSplit(records: SplittableRecord[]): InwardStatusSplit {
  const bucket = (recs: SplittableRecord[]): StatusBucket => ({
    count: new Set(recs.map((r) => r.transaction_no)).size,
    net: recs.reduce((s, r) => s + (r.net_weight || 0), 0),
    gross: recs.reduce((s, r) => s + (r.total_weight || 0), 0),
    value: recs.reduce((s, r) => s + (r.total_amount || 0), 0),
  })
  const isPending = (r: SplittableRecord) => (r.status ?? '').trim().toLowerCase() === 'pending'
  return {
    all: bucket(records),
    pending: bucket(records.filter(isPending)),
    stock: bucket(records.filter((r) => !isPending(r))),
  }
}

export function inwardStatusMeta(status?: string | null): InwardStatusMeta {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'approved':
      return { label: 'Stock Inward', tone: 'emerald', chipClass: TONE_CHIP.emerald }
    case 'pending':
      return { label: 'Pending Approval', tone: 'amber', chipClass: TONE_CHIP.amber }
    default: {
      const raw = (status ?? '').trim()
      const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown'
      return { label, tone: 'slate', chipClass: TONE_CHIP.slate }
    }
  }
}
