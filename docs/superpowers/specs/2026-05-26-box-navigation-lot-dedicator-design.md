# Box Navigation & Lot Range Dedicator — Design Spec
**Date:** 2026-05-26  
**Status:** Approved  

---

## Overview

Two features added to all IMS box-entry pages:

1. **Go to Box / Lot** — jump to a specific box number or lot_number within the scrollable box panel
2. **Box Range Lot Dedicator** — bulk-assign `lot_number` to box ranges; only active for cold storage warehouses (Savla D-39, Savla D-514, Rishi, Supreme)

---

## Feature 1 — Go to Box / Lot Navigation

### Behaviour
- A compact input + "Go" button in the box panel header
- Input accepts a **box number** (e.g. `45`) or a **lot number string** (e.g. `7648`)
- On submit (Enter or button click):
  1. If input parses as integer → scroll box with that number into view within the panel
  2. If not found as box number → scan `boxForms` for first entry whose `lot_number` matches → scroll to that box
  3. Scroll uses `scrollIntoView({ block: "nearest" })` scoped to the panel container
  4. Target box is **highlighted** with a yellow ring for 1.2 seconds
  5. First editable `<input>` inside the box row is **focused** automatically

### Component — `BoxScrollContainer`
**Location:** `frontend-/components/modules/inward/BoxScrollContainer.tsx`

**Props:**
```ts
interface BoxScrollContainerProps {
  boxCount: number
  onAddBox: () => void
  onBulkAdd?: () => void          // optional — approve/edit pages only
  boxForms: BoxForm[]             // for lot-number search resolution
  children: (registerRef: (boxNumber: number, el: HTMLElement | null) => void) => React.ReactNode
}
```

**Internals:**
- `refsMap = useRef<Map<number, HTMLElement>>(new Map())`
- `registerRef(boxNumber, el)` — registers each box row's DOM node
- `goTo(query)` — resolves query → box number → DOM node → scroll + highlight + focus
- `scrollContainerRef` — attached to the scroll div to scope `scrollIntoView`

**Header layout:**
```
[📦 Boxes (N)]  [__ Box # or lot _] [Go]      [+ Add Box] [+ Bulk Add]
```
Go input: `h-7`, width `w-36`, placeholder `"Box # or lot #"`.  
Pressing Enter calls `goTo`.

**Scroll div:**
```
style={{ maxHeight: "300px", overflowY: "auto", ... }}
```
Same bordered panel from current implementation.

**Child box rows** receive `ref` via the render-prop `registerRef`:
```tsx
{children((boxNumber, el) => refsMap.current.set(boxNumber, el))}
```

---

## Feature 2 — Box Range Lot Dedicator

### Trigger
Renders **only** when `isColdWarehouse(warehouse) === true`.  
Warehouses: Savla D-39, Savla D-514, Rishi, Supreme.  
Utility already exists at `frontend-/lib/constants/warehouses.ts`.

### Position
Collapsible panel **above** the `BoxScrollContainer`, below the article fields (Item Mark / Spl. Remarks / Vakkal row).

### Component — `LotRangeDedicator`
**Location:** `frontend-/components/modules/inward/LotRangeDedicator.tsx`

**Props:**
```ts
interface LotRangeDedicatorProps {
  warehouse: string
  totalBoxes: number
  onApply: (ranges: LotRange[]) => void
}

interface LotRange {
  from: number    // inclusive box number start
  to: number      // inclusive box number end
  lot: string     // lot_number value to assign
}
```

**Collapsed state:**
```
[ 🏷 Assign Lot Numbers to Box Ranges ▾ ]
```
Muted outlined button. Click to expand.

**Expanded state:**
- Existing ranges listed: `Boxes 1–100 → "7648"  [✕]`
- Add Range row: `[From Box ___] [To Box ___] [Lot Number ________] [+ Add]`
- Overlap validation (blocking): if new range overlaps any existing range → inline error:
  `"Boxes 32–45 are already assigned to Lot 7648. Remove that range first."`
- `[Apply to Boxes]` button → calls `onApply(ranges)` → collapses panel

### Parent apply logic (in each page)
```ts
const applyLotRanges = (ranges: LotRange[]) => {
  setBoxForms(prev => prev.map(box => {
    if (box.article_description !== currentArticle.item_description) return box
    const match = ranges.find(r => box.box_number >= r.from && box.box_number <= r.to)
    return match ? { ...box, lot_number: match.lot } : box
  }))
}
```

### Persistence
- No new backend table or API endpoint required
- `lot_number` is already a field on each `BoxForm` and is included in the existing box upsert payload on form submit
- The lot dedicator is a **frontend convenience tool** — it bulk-writes `lot_number` to individual box state entries; saving happens through the normal submit flow

---

## Pages Affected

| Page | BoxScrollContainer | LotRangeDedicator | Warehouse source |
|------|--------------------|-------------------|-----------------|
| `inward/[id]/approve/page.tsx` | ✅ | ✅ | `warehouse` state |
| `inward/new/page.tsx` | ✅ | ✅ | `warehouse` state |
| `inward/[id]/edit/page.tsx` | ✅ | ✅ | `txn.warehouse` (loaded) |
| `inward/bulk-sticker/page.tsx` | ✅ | ✅ | `warehouse` state |
| `transfer/transferform/page.tsx` | ✅ | ❌ | — |
| `transfer/directtransferform/page.tsx` | ✅ | ❌ | — |
| `transfer/job-work/page.tsx` | ✅ | ❌ | — |

**Bulk Sticker note:** `BoxScrollContainer` wraps the per-box result list shown after submission. `LotRangeDedicator` appears in the article configuration section (before submit) since warehouse is selected there.

---

## Overlap Validation Rules

- Ranges are **non-overlapping** — adding a range that shares any box number with an existing range is blocked
- Validation runs client-side only on "Add" click
- Box numbers must be ≥ 1 and ≤ `totalBoxes`
- `from` must be ≤ `to`
- `lot` must be non-empty string

---

## Files to Create

| File | Purpose |
|------|---------|
| `components/modules/inward/BoxScrollContainer.tsx` | Scroll panel + Go-to navigation |
| `components/modules/inward/LotRangeDedicator.tsx` | Range lot assignment panel |

## Files to Modify

| File | Change |
|------|--------|
| `app/[company]/inward/[id]/approve/page.tsx` | Replace scroll div + box list with `BoxScrollContainer`; add `LotRangeDedicator` |
| `app/[company]/inward/new/page.tsx` | Same |
| `app/[company]/inward/[id]/edit/page.tsx` | Same |
| `app/[company]/inward/bulk-sticker/page.tsx` | Same |
| `app/[company]/transfer/transferform/page.tsx` | `BoxScrollContainer` only |
| `app/[company]/transfer/directtransferform/page.tsx` | `BoxScrollContainer` only |
| `app/[company]/transfer/job-work/page.tsx` | `BoxScrollContainer` only |
