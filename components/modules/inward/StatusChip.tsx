import { cn } from "@/lib/utils"
import { inwardStatusMeta } from "@/lib/inward/status"

// Item 3: per-entry status chip on the Inward Summary dashboard. Relabels raw status into the
// business terms ("Stock Inward" / "Pending Approval") and is shared by the L4 transaction row and
// the InwardPeekCard hover so the two never drift. Purely presentational — it never filters.
export function StatusChip({
  status,
  className,
}: {
  status?: string | null
  className?: string
}) {
  const meta = inwardStatusMeta(status)
  return (
    <span
      data-tone={meta.tone}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
        meta.chipClass,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
