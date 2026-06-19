# Cold-Transfer Vakkal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a per-article **vakkal** at transfer-out to a cold warehouse, persist it on the transfer line, print it on the gate pass + delivery challan, and auto-fill it (editable) on the cold transfer-in receipt from the matching transfer-out.

**Architecture:** Add a nullable `vakkal` column to `interunit_transfers_lines` (mirrors `lot_number`). The backend writes/returns it on create/edit/detail. The two transfer-out forms gain a per-article Vakkal input that is **mandatory when the destination is a cold warehouse**. The shared `DeliveryChallan` component renders a Vakkal column. The cold transfer-in receipt pre-fills its existing per-article Vakkal field from the fetched transfer-out line.

**Tech Stack:** FastAPI + SQLAlchemy Core (raw `text()` SQL) + PostgreSQL (backend); Next.js 14 App Router + React + TypeScript (frontend). Backend tests = standalone `python test_*.py` scripts with hand-rolled fakes (no pytest). Frontend tests = Vitest + React Testing Library (`npm run test`).

## Global Constraints

- The DB column is `vakkal VARCHAR(100)`, nullable. Use exactly this name everywhere (column, JSON key, payload key, state field).
- The four cold-warehouse canonical codes are exactly `"Savla D-39"`, `"Savla D-514"`, `"Rishi"`, `"Supreme"` (from `WAREHOUSES` in `frontend/lib/constants/warehouses.ts`). Never hardcode this set in new code — use `isColdWarehouse(normalizeWarehouseName(code))`.
- Backend tests are standalone scripts run with `python test_<name>.py` from `c:\Backup\backend`. Do NOT add pytest / conftest / a `tests/` dir.
- Frontend tests run with `npm run test` (= `vitest run`) from `c:\Backup\frontend`. New `*.test.ts(x)` files are auto-discovered.
- This is NOT a git repository (`c:\Backup`). The "Commit" steps below are written as `git` commands for convention; if `git` is unavailable, treat each commit step as a "checkpoint — stop and let the reviewer inspect the diff" instead.
- `vakkal` is added as a NULLABLE column, so all existing INSERTs that omit it (including `cold_transfer_out_tools.py:207,432`) remain valid and untouched.

---

### Task 1: Backend — persist & return `vakkal` per transfer line

**Files:**
- Modify: `c:\Backup\backend\main.py` (startup migration, ~line 69)
- Modify: `c:\Backup\backend\services\ims_service\interunit_models.py` (line 189, line 271)
- Modify: `c:\Backup\backend\services\ims_service\interunit_tools.py` (lines 513, 571-574, 854-881, 862-865, 1485-1512, 1493-1496)
- Create: `c:\Backup\backend\test_transfer_vakkal.py`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces:
  - `TransferLineCreate.vakkal: Optional[str]` — accepted on POST/PUT `/interunit/transfers` line payloads.
  - `_map_transfer_line(row)` returns dict with key `"vakkal"` (str, `""` when absent).
  - GET `/interunit/transfers/{id}` response `lines[]` each carry a `vakkal` string. This is the contract Tasks 3 and 6 rely on.

- [ ] **Step 1: Write the failing test**

Create `c:\Backup\backend\test_transfer_vakkal.py` (follows the existing `test_inward_cold_sync.py` standalone-script convention — no DB, no pytest):

```python
"""
Vakkal on interunit transfer lines.

No database required:  python test_transfer_vakkal.py

Covers:
  - TransferLineCreate accepts `vakkal` (and the camel/alias line shape still works)
  - _map_transfer_line surfaces `vakkal` from a row
  - _map_transfer_line defaults `vakkal` to "" when the row has no such column
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ims_service.interunit_models import TransferLineCreate
from services.ims_service.interunit_tools import _map_transfer_line


class Row:
    """Minimal stand-in for a SQLAlchemy Row (attribute access)."""
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _full_row(**overrides):
    base = dict(
        id=1, header_id=10, rm_pm_fg_type="RM", item_category="CAT",
        sub_category="SUB", item_desc_raw="CASHEW", qty=5, uom="KG",
        pack_size=10, unit_pack_size=1, net_weight=50, total_weight=52,
        batch_number="B1", lot_number="L1", vakkal="VK-100",
        created_at=None, updated_at=None,
    )
    base.update(overrides)
    return Row(**base)


def test_create_model_accepts_vakkal():
    line = TransferLineCreate(
        rm_pm_fg_type="RM", item_category="CAT", sub_category="SUB",
        item_desc_raw="CASHEW", qty="5", vakkal="VK-100",
    )
    assert line.vakkal == "VK-100", line.vakkal
    # vakkal is optional — omitting it must not break the model
    line2 = TransferLineCreate(
        material_type="RM", item_category="C", sub_category="S",
        item_description="X",
    )
    assert line2.vakkal is None, line2.vakkal
    print("test_create_model_accepts_vakkal: PASS")


def test_map_surfaces_vakkal():
    mapped = _map_transfer_line(_full_row())
    assert mapped["vakkal"] == "VK-100", mapped["vakkal"]
    print("test_map_surfaces_vakkal: PASS")


def test_map_defaults_vakkal_when_missing():
    # A row produced by an INSERT/SELECT that did not include the column.
    row = _full_row()
    del row.__dict__["vakkal"]
    mapped = _map_transfer_line(row)
    assert mapped["vakkal"] == "", repr(mapped["vakkal"])
    print("test_map_defaults_vakkal_when_missing: PASS")


if __name__ == "__main__":
    test_create_model_accepts_vakkal()
    test_map_surfaces_vakkal()
    test_map_defaults_vakkal_when_missing()
    print("\nAll transfer-vakkal tests passed.")
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `c:\Backup\backend`:
```bash
python test_transfer_vakkal.py
```
Expected: FAIL — `TransferLineCreate(...)` raises (no `vakkal` field) or `_map_transfer_line` returns a dict with no `"vakkal"` key → `KeyError`/`AttributeError`.

- [ ] **Step 3: Add the startup migration**

In `c:\Backup\backend\main.py`, inside `_run_startup_migrations()`, add a new `db.execute` block immediately after the existing `line_index` ALTER (after line 69) and before `db.commit()` (line 70). Existing context:

```python
        db.execute(text("""
            ALTER TABLE interunit_transfer_in_boxes
            ADD COLUMN IF NOT EXISTS line_index INTEGER
        """))
        db.commit()
```

Becomes:

```python
        db.execute(text("""
            ALTER TABLE interunit_transfer_in_boxes
            ADD COLUMN IF NOT EXISTS line_index INTEGER
        """))
        db.execute(text("""
            ALTER TABLE interunit_transfers_lines
            ADD COLUMN IF NOT EXISTS vakkal VARCHAR(100)
        """))
        db.commit()
```

- [ ] **Step 4: Add `vakkal` to the Pydantic schemas**

In `c:\Backup\backend\services\ims_service\interunit_models.py`:

In `TransferLineCreate`, after line 189 (`lot_number: Optional[str] = None`):
```python
    lot_number: Optional[str] = None
    vakkal: Optional[str] = None
```

In `TransferLineResponse`, after line 271 (`lot_number: Optional[str] = None`):
```python
    lot_number: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 5: Make the row→dict mapper surface `vakkal` (defensively)**

In `c:\Backup\backend\services\ims_service\interunit_tools.py`, in `_map_transfer_line` (def @ 498), after line 513 (`"lot_number": row.lot_number or "",`):
```python
        "lot_number": row.lot_number or "",
        "vakkal": getattr(row, "vakkal", None) or "",
```
(`getattr` keeps the mapper safe for any row source whose SELECT/RETURNING omits the column.)

- [ ] **Step 6: Add `vakkal` to the CREATE INSERT (SQL columns, VALUES, RETURNING, params)**

In `interunit_tools.py`, in `create_transfer`, update the INSERT at lines 854-866 and its params dict at 867-881. The SQL becomes:
```python
            text("""
                INSERT INTO interunit_transfers_lines
                    (header_id, rm_pm_fg_type, item_category, sub_category,
                     item_desc_raw, pack_size, qty, uom,
                     unit_pack_size, net_weight, total_weight, batch_number, lot_number, vakkal)
                VALUES
                    (:header_id, :material_type, :item_category, :sub_category,
                     :item_desc_raw, :pack_size, :quantity, :uom,
                     :unit_pack_size, :net_weight, :total_weight, :batch_number, :lot_number, :vakkal)
                RETURNING id, header_id, rm_pm_fg_type, item_category, sub_category,
                          item_desc_raw, pack_size, qty, uom,
                          unit_pack_size, net_weight, total_weight, batch_number, lot_number, vakkal,
                          created_at, updated_at
            """),
```
And in the params dict, after line 880 (`"lot_number": line.lot_number or "",`):
```python
                "lot_number": line.lot_number or "",
                "vakkal": line.vakkal or "",
```

- [ ] **Step 7: Add `vakkal` to the EDIT/UPDATE INSERT (SQL columns, VALUES, RETURNING, params)**

In `interunit_tools.py`, in `update_transfer`, the INSERT at lines 1485-1497 is byte-identical to the create one — apply the same change. The SQL becomes:
```python
            text("""
                INSERT INTO interunit_transfers_lines
                    (header_id, rm_pm_fg_type, item_category, sub_category,
                     item_desc_raw, pack_size, qty, uom,
                     unit_pack_size, net_weight, total_weight, batch_number, lot_number, vakkal)
                VALUES
                    (:header_id, :material_type, :item_category, :sub_category,
                     :item_desc_raw, :pack_size, :quantity, :uom,
                     :unit_pack_size, :net_weight, :total_weight, :batch_number, :lot_number, :vakkal)
                RETURNING id, header_id, rm_pm_fg_type, item_category, sub_category,
                          item_desc_raw, pack_size, qty, uom,
                          unit_pack_size, net_weight, total_weight, batch_number, lot_number, vakkal,
                          created_at, updated_at
            """),
```
And in its params dict, after line 1511 (`"lot_number": line.lot_number or "",`):
```python
                "lot_number": line.lot_number or "",
                "vakkal": line.vakkal or "",
```

- [ ] **Step 8: Add `vakkal` to the detail SELECT**

In `interunit_tools.py`, in `_fetch_transfer_lines` (def @ 568), update the SELECT column list at lines 571-574:
```python
            SELECT id, header_id, rm_pm_fg_type, item_category, sub_category,
                   item_desc_raw, pack_size, qty, uom,
                   unit_pack_size, net_weight, total_weight, batch_number, lot_number, vakkal,
                   created_at, updated_at
            FROM interunit_transfers_lines
```

- [ ] **Step 9: Run the test to verify it passes**

Run from `c:\Backup\backend`:
```bash
python test_transfer_vakkal.py
```
Expected: PASS — prints three `... : PASS` lines and `All transfer-vakkal tests passed.`

- [ ] **Step 10: Manual DB round-trip sanity (optional but recommended)**

Start the backend (so `_run_startup_migrations` runs), then confirm the column exists:
```bash
python -c "from shared.database import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print([r[0] for r in db.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='interunit_transfers_lines'\"))]); db.close()"
```
Expected: the printed list includes `vakkal`.

- [ ] **Step 11: Commit**

```bash
git add backend/main.py backend/services/ims_service/interunit_models.py backend/services/ims_service/interunit_tools.py backend/test_transfer_vakkal.py
git commit -m "feat(transfer): persist and return per-line vakkal on interunit transfers"
```

---

### Task 2: Shared transfer line types — add `vakkal`

**Files:**
- Modify: `c:\Backup\frontend\types\transfer.ts` (line 73)
- Modify: `c:\Backup\frontend\lib\api\interunit.ts` (lines 161, 180)

**Interfaces:**
- Consumes: Task 1's `lines[].vakkal` contract (type only).
- Produces: `TransferLine.vakkal?`, `InterUnitTransferLine.vakkal?`, `InterUnitTransferLineCreate.vakkal?` — optional string fields. These are type-hygiene only (the live forms use untyped `any` service methods), but they keep the typed API surface honest.

- [ ] **Step 1: Add `vakkal` to `types/transfer.ts`**

In `c:\Backup\frontend\types\transfer.ts`, in `interface TransferLine`, after line 73 (`lot_number: string`):
```ts
  lot_number: string
  vakkal?: string
```

- [ ] **Step 2: Add `vakkal` to the typed API line interfaces**

In `c:\Backup\frontend\lib\api\interunit.ts`:

In `interface InterUnitTransferLine`, after line 161 (`lot_number?: string`):
```ts
  lot_number?: string
  vakkal?: string
```

In `interface InterUnitTransferLineCreate`, after line 180 (`lot_number?: string`):
```ts
  lot_number?: string
  vakkal?: string
```

- [ ] **Step 3: Verify the project still type-checks**

Run from `c:\Backup\frontend`:
```bash
npx tsc --noEmit
```
Expected: no NEW type errors introduced by these additions (pre-existing errors, if any, are unchanged).

- [ ] **Step 4: Commit**

```bash
git add frontend/types/transfer.ts frontend/lib/api/interunit.ts
git commit -m "feat(transfer): add optional vakkal to shared transfer line types"
```

---

### Task 3: DeliveryChallan — render a Vakkal column on DC + gate pass

**Files:**
- Modify: `c:\Backup\frontend\components\transfer\DeliveryChallan.tsx`
- Create: `c:\Backup\frontend\components\transfer\DeliveryChallan.test.tsx`

**Interfaces:**
- Consumes: each `items[]` element may carry `vakkal?: string` (from Task 1 via the `dc/[transferId]` route, which passes `transferData.lines` through untouched).
- Produces: nothing downstream (leaf component).

**Note on column placement:** Vakkal is inserted as the 3rd column (immediately after **Item Description**) on BOTH tables. This shifts the DC totals-row label span by one and adds one cell/colSpan across the gate-pass rows — every such change is enumerated below.

- [ ] **Step 1: Write the failing test**

Create `c:\Backup\frontend\components\transfer\DeliveryChallan.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import DeliveryChallan from "./DeliveryChallan"

// The component calls window.print() on a timer; stub it so jsdom doesn't throw.
beforeEach(() => {
  vi.stubGlobal("print", vi.fn())
})

const baseProps = {
  dcNumber: "TRF-1",
  requestDate: "18-06-2026",
  fromWarehouse: "W202",
  toWarehouse: "Savla D-39",
  vehicleNumber: "MH-01",
  driverName: "Driver",
  approvalAuthority: "Auth",
  reasonDescription: "Cold move",
  totalQtyRequired: 5,
  boxesProvided: 1,
  boxesPending: 0,
  warehouseAddresses: {} as Record<string, { name: string; address: string }>,
}

describe("DeliveryChallan vakkal column", () => {
  it("renders a Vakkal header and the per-item vakkal value", () => {
    render(
      <DeliveryChallan
        {...baseProps}
        items={[
          { item_description: "CASHEW", item_category: "NUTS", qty: 5, net_weight: 50, vakkal: "VK-9" },
        ]}
      />
    )
    // Header appears on both the DC table and the gate pass table.
    expect(screen.getAllByText("Vakkal").length).toBeGreaterThanOrEqual(2)
    // The value appears (once per table).
    expect(screen.getAllByText("VK-9").length).toBeGreaterThanOrEqual(2)
  })

  it("renders an em-dash when an item has no vakkal", () => {
    render(
      <DeliveryChallan
        {...baseProps}
        items={[{ item_description: "SALT", item_category: "MISC", qty: 1, net_weight: 1 }]}
      />
    )
    expect(screen.getAllByText("Vakkal").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `c:\Backup\frontend`:
```bash
npx vitest run components/transfer/DeliveryChallan.test.tsx
```
Expected: FAIL — no "Vakkal" header exists yet.

- [ ] **Step 3: Bump `DC_COLS` for the new column**

In `DeliveryChallan.tsx`, line 93:
```tsx
  const DC_COLS = showCountColumn ? 10 : 9
```

- [ ] **Step 4: Add a `<col>` to the DC colgroup**

In `DeliveryChallan.tsx`, the colgroup at lines 233-259 renders one `<col>` per column, with the Item Description col flexible. Add one plain `<col />` directly after the `<col style={{ width: 'auto' }} />` in BOTH branches. Result:

```tsx
            <colgroup>
              {showCountColumn ? (
                <>
                  <col />
                  {/* Item Description grabs leftover space */}
                  <col style={{ width: 'auto' }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </>
              ) : (
                <>
                  <col />
                  <col style={{ width: 'auto' }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </>
              )}
            </colgroup>
```
(showCountColumn branch now has 10 `<col>`; the other has 9.)

- [ ] **Step 5: Add the Vakkal header cell to the DC column-header row**

In `renderDCHeader`, after the Item Description `<td>` (line 203), insert:
```tsx
        <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: 'bold', fontSize: '10.5px' }}>Item Description</td>
        <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Vakkal</td>
        <td style={{ padding: '6px 8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>Category</td>
```

- [ ] **Step 6: Add the Vakkal data cell to the DC body row**

In the DC body `<tr>` (lines 269-299), after the Item Description `<td>` (lines 271-273), insert the Vakkal cell:
```tsx
                    <td style={{ padding: '5px 8px', border: '1px solid #000', fontSize: '10.5px', wordBreak: 'break-word' }}>
                      {item.item_desc_raw || item.item_description || 'N/A'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.vakkal || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #000', textAlign: 'center', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      {item.item_category || 'N/A'}
                    </td>
```

- [ ] **Step 7: Widen the DC totals-row label span**

In the totals row (lines 307-332), the "TOTAL (...)" label `<td>` currently spans 3 columns (S.No + Item Description + Category). With Vakkal inserted between them it must span 4. Change line 308:
```tsx
                    <td colSpan={4} style={{ padding: '8px 8px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'right', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                      TOTAL ({consolidatedItems.length} item{consolidatedItems.length !== 1 ? 's' : ''}):
                    </td>
```
(No other cell in this row changes — the remaining cells still align under No. of Boxes / Qty / UOM / Pack Size / Net Wt / Count.)

- [ ] **Step 8: Replace the gate-pass colgroup**

In the gate-pass table, replace the colgroup at lines 394-401 with a version that adds a Vakkal column (Vakkal as 3rd col) and rebalances widths:
```tsx
        <colgroup>
          <col style={{ width: hasPMItems ? '6%' : '7%' }} />
          <col style={{ width: hasPMItems ? '26%' : '33%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: hasPMItems ? '14%' : '25%' }} />
          {hasPMItems && <col style={{ width: '18%' }} />}
        </colgroup>
```

- [ ] **Step 9: Update gate-pass colSpans that span the full width or shifted groups**

The gate pass total column count goes from `hasPMItems ? 6 : 5` to `hasPMItems ? 7 : 6`. Update each of these:

Title row (line 404):
```tsx
            <td colSpan={hasPMItems ? 7 : 6} style={{
```

Header-info row 1 — bump the Driver cell (line 436) from `hasPMItems ? 2 : 1` to `hasPMItems ? 3 : 2`:
```tsx
            <td colSpan={hasPMItems ? 3 : 2} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>Driver:</strong> {driverName}
            </td>
```

Header-info row 2 — bump the From cell (line 442) from `hasPMItems ? 3 : 2` to `hasPMItems ? 4 : 3`:
```tsx
            <td colSpan={hasPMItems ? 4 : 3} style={{ padding: '8px', border: '1px solid #000' }}>
              <strong>From:</strong> Candor Foods - {warehouseAddresses[fromWarehouse]?.name || fromWarehouse}
            </td>
```

ITEMS SUMMARY banner (line 452):
```tsx
            <td colSpan={hasPMItems ? 7 : 6} style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>
              ITEMS SUMMARY
            </td>
```

Signatures row — bump the Security cell (line 523) from `hasPMItems ? 3 : 2` to `hasPMItems ? 4 : 3`:
```tsx
            <td colSpan={hasPMItems ? 4 : 3} style={{ padding: '25px 8px 8px 8px', border: '1px solid #000', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '5px', marginTop: '30px' }}>
                <strong>Security Sign</strong>
              </div>
            </td>
```

Footer row (line 536):
```tsx
            <td colSpan={hasPMItems ? 7 : 6} style={{
```

- [ ] **Step 10: Add the Vakkal header + body cells to the gate-pass items table**

Gate-pass items header row — after the Item Description `<td>` (line 458), insert:
```tsx
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Item Description</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Vakkal</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold', textAlign: 'center' }}>Boxes</td>
```

Gate-pass body row — after the Item Description `<td>` (lines 472-474), insert:
```tsx
                <td style={{ padding: '5px', border: '1px solid #000' }}>
                  {item.item_desc_raw || item.item_description || 'N/A'}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center' }}>
                  {item.vakkal || '—'}
                </td>
                <td style={{ padding: '5px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                  {Number(item.box_count || 0).toLocaleString('en-IN')}
                </td>
```

- [ ] **Step 11: Add a filler cell to the gate-pass summary-totals row**

The summary-totals row (lines 496-519) has one `<td>` per column. Add one blank cell after the "Total Items" cell (line 497) so the row keeps full width with the new Vakkal column:
```tsx
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Items: {consolidatedItems.length}</td>
            <td style={{ padding: '6px', border: '1px solid #000' }}>&nbsp;</td>
            <td style={{ padding: '6px', border: '1px solid #000', fontWeight: 'bold' }}>Total Qty: {Number(totalQtyRequired || 0).toLocaleString('en-IN')}</td>
```
(The remaining cells — Total Boxes, Total Kg, Status, and the conditional Total Count — are unchanged.)

- [ ] **Step 12: Run the test to verify it passes**

Run from `c:\Backup\frontend`:
```bash
npx vitest run components/transfer/DeliveryChallan.test.tsx
```
Expected: PASS — both tests green.

- [ ] **Step 13: Commit**

```bash
git add frontend/components/transfer/DeliveryChallan.tsx frontend/components/transfer/DeliveryChallan.test.tsx
git commit -m "feat(transfer): show Vakkal column on delivery challan and gate pass"
```

---

### Task 4: Direct transfer-out form — capture vakkal, mandatory for cold

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\transfer\directtransferform\page.tsx`
- Create: `c:\Backup\frontend\lib\constants\warehouses.test.ts`

**Interfaces:**
- Consumes: `isColdWarehouse`, `normalizeWarehouseName` from `@/lib/constants/warehouses`; Task 1's backend accepts `lines[].vakkal`.
- Produces: transfer-out payloads whose `lines[]` carry `vakkal`. Cold-destination transfers are blocked at submit unless every line has a non-empty vakkal.

- [ ] **Step 1: Write the failing test (cold-warehouse helper)**

Create `c:\Backup\frontend\lib\constants\warehouses.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isColdWarehouse, normalizeWarehouseName } from "./warehouses"

describe("cold warehouse detection (gates mandatory vakkal)", () => {
  it("flags the four cold warehouses as cold", () => {
    for (const code of ["Savla D-39", "Savla D-514", "Rishi", "Supreme"]) {
      expect(isColdWarehouse(code)).toBe(true)
    }
  })

  it("does not flag regular warehouses as cold", () => {
    for (const code of ["W202", "A85", "F53", "A68"]) {
      expect(isColdWarehouse(code)).toBe(false)
    }
  })

  it("normalizes an alias to its canonical cold code", () => {
    // normalizeWarehouseName lower-cases and maps aliases; a known cold code
    // round-trips to itself, and isColdWarehouse(normalize(...)) holds.
    expect(isColdWarehouse(normalizeWarehouseName("savla d-39"))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it passes for the helper, then confirm baseline**

Run from `c:\Backup\frontend`:
```bash
npx vitest run lib/constants/warehouses.test.ts
```
Expected: PASS (the helper already exists). This test locks the cold set that the mandatory-vakkal logic relies on. If `A85` is not present in `WAREHOUSES`, `isColdWarehouse("A85")` returns `false` (correct for this test) — the assertion still holds.

- [ ] **Step 3: Import the cold-warehouse helpers**

In `directtransferform/page.tsx`, after the existing import block (after line 23), add:
```tsx
import { isColdWarehouse, normalizeWarehouseName } from "@/lib/constants/warehouses"
```

- [ ] **Step 4: Add `vakkal` to the `Article` interface and both default literals**

In `directtransferform/page.tsx`:

`Article` interface — after line 329 (`lot_number: string`):
```tsx
    lot_number: string
    vakkal: string
```

Initial `useState` default — after line 364 (`lot_number: "",`):
```tsx
      lot_number: "",
      vakkal: "",
```

`addArticle` default — after line 911 (`lot_number: "",`):
```tsx
      lot_number: "",
      vakkal: "",
```

- [ ] **Step 5: Add the Vakkal input to the article entry grid**

In `directtransferform/page.tsx`, insert a new field `<div>` between the Lot Number `</div>` (line 2752) and the grid-closing `</div>` (line 2753):
```tsx
                    </div>

                    {/* Vakkal (required for cold destinations) */}
                    <div className="space-y-1">
                      <Label htmlFor={`vakkal_${article.id}`}>
                        Vakkal{isColdWarehouse(normalizeWarehouseName(formData.toWarehouse)) ? ' *' : ' '}
                        {!isColdWarehouse(normalizeWarehouseName(formData.toWarehouse)) && (
                          <span className="text-gray-400 font-normal">(Optional)</span>
                        )}
                      </Label>
                      <Input
                        id={`vakkal_${article.id}`}
                        type="text"
                        value={article.vakkal}
                        onChange={(e) => updateArticle(article.id, "vakkal", e.target.value)}
                        placeholder="Enter vakkal"
                      />
                    </div>
                  </div>
```

- [ ] **Step 6: Carry vakkal into each scanned-box entry on "Add to List"**

In `handleAddArticleToList`, in the `newEntries.push({ ... })` object, after line 1152 (`lotNumber: article.lot_number || 'N/A',`):
```tsx
        lotNumber: article.lot_number || 'N/A',
        vakkal: article.vakkal || '',
```

- [ ] **Step 7: Send vakkal in the submit payload lines**

In the submit handler, the `lines` map at lines 1859-1875. After line 1874 (`lot_number: cleanNull(box.lotNumber)`) add a trailing comma and the vakkal field:
```tsx
      batch_number: cleanNull(box.batchNumber),
      lot_number: cleanNull(box.lotNumber),
      vakkal: cleanNull(box.vakkal)
    }))
```

- [ ] **Step 8: Block submit when a cold destination is missing any vakkal**

In the submit handler, immediately before the terminal `if (errors.length > 0)` block (line 1835), add:
```tsx
    // Vakkal is mandatory per article when the destination is a cold warehouse
    if (isColdWarehouse(normalizeWarehouseName(formData.toWarehouse))) {
      const missingVakkal = new Set<string>()
      scannedBoxes.forEach((box) => {
        if (!box.vakkal || !String(box.vakkal).trim()) {
          missingVakkal.add(box.itemDescription || 'Unknown item')
        }
      })
      missingVakkal.forEach((desc) =>
        errors.push(`${desc}: Vakkal is required for transfers to a cold warehouse`)
      )
    }

```

- [ ] **Step 9: Restore vakkal on edit-load**

In `directtransferform/page.tsx`, the edit-load effect rebuilds `articles[0]` and `scannedBoxes` from a fetched transfer. Add vakkal in four places:

(a) First-article repopulation — after line 708 (`batch_number: firstLine.batch_number || "",`):
```tsx
                batch_number: firstLine.batch_number || "",
                vakkal: firstLine.vakkal || "",
```

(b) Before the QR-boxes `.map` at line 727, build a lookup from the transfer lines so QR-derived boxes can recover their line's vakkal. Insert just above the `const qrBoxes = transfer.boxes.map(...)`:
```tsx
          const _vnorm = (s: any) => String(s ?? "").trim().toUpperCase()
          const vakkalByKey = new Map<string, string>()
          ;(transfer.lines || []).forEach((l: any) => {
            vakkalByKey.set(`${_vnorm(l.item_description)}|${_vnorm(l.lot_number)}`, l.vakkal || "")
          })
```
Then in the qrBoxes object, after line 746 (`lotNumber: box.lot_number || "",`):
```tsx
              lotNumber: box.lot_number || "",
              vakkal: vakkalByKey.get(`${_vnorm(box.article)}|${_vnorm(box.lot_number)}`) || "",
```

(c) Direct-entries `.map` (from `manualLines`) — after line 791 (`lotNumber: line.lot_number || "",`):
```tsx
              lotNumber: line.lot_number || "",
              vakkal: line.vakkal || "",
```

(d) No-QR-boxes fallback `.map` (from `transfer.lines`) — after line 822 (`lotNumber: line.lot_number || "",`):
```tsx
              lotNumber: line.lot_number || "",
              vakkal: line.vakkal || "",
```

- [ ] **Step 10: Type-check and run the helper test**

Run from `c:\Backup\frontend`:
```bash
npx tsc --noEmit
npx vitest run lib/constants/warehouses.test.ts
```
Expected: no new type errors; warehouses test PASS.

- [ ] **Step 11: Manual verification (form behavior)**

Start the frontend (`npm run dev` from `c:\Backup\frontend`) and the backend. As a user:
1. Open Transfer → Create Transfer OUT (the direct transfer form). Set To Warehouse = `Savla D-39`. Add an article WITHOUT a vakkal → Submit → expect a destructive toast `"<item>: Vakkal is required for transfers to a cold warehouse"`, submit blocked.
2. Fill the Vakkal on the article, re-add, Submit → expect success.
3. Open the saved transfer's DC route (`/<company>/transfer/dc/<id>`) → the Vakkal column shows the entered value on both the delivery challan and gate pass.
4. Re-open the transfer for edit (`directtransferform?editId=<id>`) → the Vakkal value is repopulated on the article/box entries.
5. Set To Warehouse = a regular warehouse (e.g. `W202`) → Vakkal field shows `(Optional)`, submit succeeds with it blank.

- [ ] **Step 12: Commit**

```bash
git add frontend/app/\[company\]/transfer/directtransferform/page.tsx frontend/lib/constants/warehouses.test.ts
git commit -m "feat(transfer): capture per-article vakkal on direct transfer-out, mandatory for cold"
```

---

### Task 5: Request-fulfillment transfer-out form — capture vakkal, mandatory for cold

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\transfer\transferform\page.tsx`

**Interfaces:**
- Consumes: `isColdWarehouse`, `normalizeWarehouseName`; Task 1's backend accepts `lines[].vakkal`.
- Produces: request→transfer-out payloads whose `lines[]` carry `vakkal`; cold destinations blocked unless every article has a vakkal.

Note: this form builds `lines` directly from `articles` (not from `scannedBoxes`), so vakkal flows article → line directly. It does not render a DeliveryChallan and has no edit-load (it is create-from-request only), so there are fewer touch points than Task 4.

- [ ] **Step 1: Import the cold-warehouse helpers**

In `transferform/page.tsx`, after the import block (after line 23), add:
```tsx
import { isColdWarehouse, normalizeWarehouseName } from "@/lib/constants/warehouses"
```

- [ ] **Step 2: Add `vakkal` to the `Article` interface and both default literals**

`Article` interface — after line 321 (`lot_number: string`):
```tsx
    lot_number: string
    vakkal: string
```

Initial `useState` default — after line 346 (`lot_number: "",`):
```tsx
      lot_number: "",
      vakkal: "",
```

`addArticle` default (lines 681-704) — after its `lot_number: "",` line:
```tsx
      lot_number: "",
      vakkal: "",
```

- [ ] **Step 3: Add the Vakkal input to the article grid**

In `transferform/page.tsx`, insert a new field `<div>` between the Lot Number `</div>` (line 2450) and the grid-closing `</div>` (line 2451):
```tsx
                </div>

                {/* Vakkal (required for cold destinations) */}
                <div>
                  <Label htmlFor={`vakkal_${article.id}`}>
                    Vakkal{isColdWarehouse(normalizeWarehouseName(formData.toWarehouse)) ? ' *' : ' '}
                    {!isColdWarehouse(normalizeWarehouseName(formData.toWarehouse)) && (
                      <span className="text-gray-400 font-normal">(Optional)</span>
                    )}
                  </Label>
                  <Input
                    id={`vakkal_${article.id}`}
                    type="text"
                    value={article.vakkal}
                    onChange={(e) => updateArticle(article.id, "vakkal", e.target.value)}
                    placeholder="Enter vakkal"
                  />
                </div>
              </div>
```

- [ ] **Step 4: Send vakkal in the submit payload lines**

In `handleSubmit`, the `lines` map at lines 1657-1670. After line 1669 (`lot_number: null`) add a trailing comma and the vakkal field:
```tsx
        batch_number: null,
        lot_number: null,
        vakkal: article.vakkal || null
      })),
```

- [ ] **Step 5: Block submit when a cold destination is missing any vakkal**

In `handleSubmit`, inside the per-article validation loop (`articles.forEach((article, index) => { ... })` at lines 1569-1587), add a vakkal check after the item-description check (after line 1584):
```tsx
      if (!article.item_description) {
        errors.push(`Article ${index + 1}: Item description is required`)
      }

      if (
        isColdWarehouse(normalizeWarehouseName(formData.toWarehouse)) &&
        (!article.vakkal || !article.vakkal.trim())
      ) {
        errors.push(`Article ${index + 1}: Vakkal is required for transfers to a cold warehouse`)
      }
```

- [ ] **Step 6: Type-check**

Run from `c:\Backup\frontend`:
```bash
npx tsc --noEmit
```
Expected: no new type errors.

- [ ] **Step 7: Manual verification**

With frontend + backend running: open an approved request and fulfill it via `transferform` (`/<company>/transfer/transferform?requestId=<id>`). Set To Warehouse to a cold warehouse, leave an article's Vakkal blank → Submit → expect `"Article N: Vakkal is required..."` and blocked submit. Fill it → submit succeeds. Open the resulting transfer's DC route → Vakkal prints.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/\[company\]/transfer/transferform/page.tsx
git commit -m "feat(transfer): capture per-article vakkal when fulfilling a request, mandatory for cold"
```

---

### Task 6: Cold transfer-in — auto-fill vakkal from the transfer-out

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\cold-transfer\coldtransfer-in\page.tsx`

**Interfaces:**
- Consumes: Task 1's GET `/interunit/transfers/{id}` returns `lines[].vakkal` (the receipt screen already fetches the transfer-out via `InterunitApiService.getTransferByNumber`, line 326, and iterates `response.lines`, line 469).
- Produces: nothing downstream. The per-article Vakkal field is pre-filled and remains editable; the existing submit wiring (lines 1907/1932/1957) already sends `ci.vakkal`.

- [ ] **Step 1: Pre-fill the cold-item map's vakkal from the transfer-out line**

In `coldtransfer-in/page.tsx`, in the `coldMap[name] = { ... }` initializer (lines 473-479), change line 474 from `vakkal: ""` to read the line's vakkal:
```tsx
          coldMap[name] = {
            inward_dt: today, vakkal: line.vakkal || "", lot_no: "", rate: "",
            exporter: "", storage_location: toWarehouse, item_mark: "",
            group_name: line.item_category || "",
            item_subgroup: line.sub_category || "",
            cold_company: (company || "cfpl").toLowerCase(), spl_remarks: "",
          }
```
(`line` is the `.forEach((line: any) => ...)` callback parameter, already in scope and already used for `item_category`/`sub_category`.)

- [ ] **Step 2: Type-check**

Run from `c:\Backup\frontend`:
```bash
npx tsc --noEmit
```
Expected: no new type errors.

- [ ] **Step 3: Manual verification (end-to-end auto-pick)**

With frontend + backend running:
1. Create a transfer-out from a regular warehouse (e.g. `W202`) to a cold warehouse (e.g. `Savla D-39`) with a vakkal per article (Task 4).
2. Go to the cold transfer-in receipt for that transfer-out (scan/enter its challan no). In the "Cold Storage Details" section, each item's **Vakkal** field is pre-filled with the value entered at dispatch.
3. Edit one Vakkal value → confirm it remains editable and the edited value is what gets submitted.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\[company\]/cold-transfer/coldtransfer-in/page.tsx
git commit -m "feat(cold-transfer): auto-fill receipt vakkal from the matching transfer-out line"
```

---

## Self-Review

**1. Spec coverage:**
- Spec §1 "persist & return vakkal per line" → Task 1. ✔
- Spec §2 "transfer-out forms, mandatory for cold" → Tasks 4 (directtransferform) + 5 (transferform). ✔ Both forms covered per the confirmed decision.
- Spec §3 "documents always show a Vakkal column" → Task 3 (both DC table and gate-pass table; the `dc/[transferId]` route needs no change because it forwards `lines` untouched). ✔
- Spec §4 "cold transfer-in auto-pick, editable" → Task 6 (pre-fill `line.vakkal`, field stays editable). ✔
- Spec "shared/typed surfaces" → Task 2. ✔
- Edge case "same article, two vakkals" — the cold transfer-in keys by article name and takes the first line's vakkal; documented in the spec, no code change needed. ✔
- Edge case "historical/non-cold → blank" — `vakkal` nullable, documents render `'—'`. ✔

**2. Placeholder scan:** No TBD/TODO/"handle errors"/"similar to". Every code step shows complete code. ✔

**3. Type consistency:** The field is `vakkal` (string) at every layer: DB column `vakkal`, Pydantic `TransferLineCreate.vakkal`/`TransferLineResponse.vakkal`, mapper key `"vakkal"`, JSON `lines[].vakkal`, TS interfaces `TransferLine.vakkal`/`InterUnitTransferLine(.Create).vakkal`, form `Article.vakkal`, scannedBox `vakkal`, payload line `vakkal`, `coldMap[name].vakkal`, DC `item.vakkal`. Cold detection uses `isColdWarehouse(normalizeWarehouseName(...))` consistently in both forms. ✔

**4. Mapper safety:** `_map_transfer_line` reads `getattr(row, "vakkal", None) or ""`, so it tolerates any row whose SELECT/RETURNING omits the column; all three transfer-line SQL sites (create RETURNING, update RETURNING, detail SELECT) are updated to include `vakkal`, so real values surface. Other writers of the table (`cold_transfer_out_tools.py:207,432`, the weight-only UPDATE @3260) never feed the mapper and need no change. ✔
