# Reordering (RTV/CR) — Canonical Warehouses & Cold Article Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reordering (RTV/Customer-Return) module use canonical cold-warehouse codes and capture per-article cold fields (lot no, item mark, special remarks, vakkal), with box-range lot assignment, go-to-box/lot, bulk box entry, and bulk/range QR printing — so cold lots become cross-linkable like the inward module.

**Architecture:** Extend the existing RTV module in place, mirroring the inward module's proven patterns and reusing the shared `warehouses.ts` constants plus the already-wired `BoxScrollContainer` / `LotRangeDedicator`. Backend adds three columns (`item_mark`, `spl_remarks`, `vakkal`) to the lines + boxes tables (plus `lot_number` to lines), canonicalizes `factory_unit` on write, and implements the missing bulk-boxes sync endpoint. The active write into `cold_stocks` is deferred to Phase 2.

**Tech Stack:** Backend — FastAPI + SQLAlchemy Core (`text()`), Pydantic v2, Postgres (company-partitioned `cfpl_*`/`cdpl_*` tables), dependency-free pytest-style tests via `FakeDB`. Frontend — Next.js 14 / React 18 / TypeScript, shadcn-ui, `qrcode`, vitest + testing-library.

---

## Naming decision (locked)

Use the **inward** field names verbatim so the data lines up for cross-linking and canonicalization: **`lot_number`, `item_mark`, `spl_remarks`, `vakkal`**. The UI label for `spl_remarks` is "Spl. Remarks" / "Special Remarks", but the field key everywhere (TS, Pydantic, SQL, payloads) is `spl_remarks`. Verified against `backend/test_approve_inward_cold_fields.py` and `inward_models.py`.

## Cold-gating rule (locked)

Cold article fields and the lot dedicator render **only** when `isColdWarehouse(factoryUnit) === true` (from `frontend/lib/constants/warehouses.ts`). After Task 9 the dropdown stores canonical codes (`Savla D-39`, `Savla D-514`, `Rishi`, `Supreme`), so this predicate finally evaluates true for cold CRs — which is what currently keeps `LotRangeDedicator` invisible.

## File Structure / Change Map

**Backend (`c:\Backup\backend`)**
- Create: `migrations/2026-06-18_rtv_cold_article_fields.sql` — add columns to lines + boxes.
- Modify: `services/ims_service/rtv_models.py` — cold fields on line/box/approval models; new bulk-box models.
- Modify: `services/ims_service/rtv_tools.py` — persist/return cold fields; canonicalize `factory_unit`; new `bulk_save_boxes` tool; lot+cold fields in `approve_rtv` box write.
- Modify: `services/ims_service/rtv_server.py` — new `PUT /{company}/{rtv_id}/boxes` endpoint.
- Create: `test_rtv_cold_fields.py` — dependency-free tests (FakeDB).
- Create: `test_rtv_bulk_boxes.py` — dependency-free tests for the new endpoint/tool.
- Create: `test_rtv_canonical_warehouse.py` — dependency-free test for canonicalization.

**Frontend (`c:\Backup\frontend`)**
- Create: `components/modules/warehouse/WarehouseSelect.tsx` — shared canonical warehouse `<Select>`.
- Create: `components/modules/warehouse/__tests__/WarehouseSelect.test.tsx` — vitest.
- Modify: `types/rtv.ts` — cold fields on line/box/bulk/approval interfaces.
- Modify: `app/[company]/reordering/new/page.tsx` — WarehouseSelect; cold article fields (gated); persist on create; lot+item_mark on label.
- Modify: `app/[company]/reordering/[id]/approve/page.tsx` — WarehouseSelect; cold article fields + cascade; bulk box entry; print-all + per-article range print; cold fields in bulk save + label.
- Modify: `app/[company]/reordering/[id]/page.tsx` — post-approval editing: cold fields, lot dedicator, range print, reprint.
- Modify: `app/[company]/reordering/page.tsx` — display warehouse via `getDisplayWarehouseName`.
- Create: `lib/utils/rtvCold.ts` — pure helpers (cascade + lot-range apply + bulk fill) with a vitest test `lib/utils/__tests__/rtvCold.test.ts`.

---

## Phase 1 Tasks

### Task 1: DB migration — cold columns on lines + boxes

**Files:**
- Create: `c:\Backup\backend\migrations\2026-06-18_rtv_cold_article_fields.sql`

- [ ] **Step 1: Write the migration SQL** (mirrors the existing `2026-06-09_rtv_header_logistics_fields.sql` `ADD COLUMN IF NOT EXISTS` style; idempotent)

```sql
-- 2026-06-18 RTV: per-article cold fields. lot_number already exists on *_rtv_boxes;
-- add it to *_rtv_lines (article-level default) and add item_mark/spl_remarks/vakkal
-- to both lines and boxes so RTV cold lots are cross-linkable like inward.

ALTER TABLE cfpl_rtv_lines
  ADD COLUMN IF NOT EXISTS lot_number  varchar,
  ADD COLUMN IF NOT EXISTS item_mark   varchar,
  ADD COLUMN IF NOT EXISTS spl_remarks varchar,
  ADD COLUMN IF NOT EXISTS vakkal      varchar;

ALTER TABLE cdpl_rtv_lines
  ADD COLUMN IF NOT EXISTS lot_number  varchar,
  ADD COLUMN IF NOT EXISTS item_mark   varchar,
  ADD COLUMN IF NOT EXISTS spl_remarks varchar,
  ADD COLUMN IF NOT EXISTS vakkal      varchar;

ALTER TABLE cfpl_rtv_boxes
  ADD COLUMN IF NOT EXISTS item_mark   varchar,
  ADD COLUMN IF NOT EXISTS spl_remarks varchar,
  ADD COLUMN IF NOT EXISTS vakkal      varchar;

ALTER TABLE cdpl_rtv_boxes
  ADD COLUMN IF NOT EXISTS item_mark   varchar,
  ADD COLUMN IF NOT EXISTS spl_remarks varchar,
  ADD COLUMN IF NOT EXISTS vakkal      varchar;
```

- [ ] **Step 2: Apply the migration** against the dev database (this repo applies `.sql` files manually via psql — no runner script exists). Use the connection string from `backend/.env`.

Run: `psql "$DATABASE_URL" -f migrations/2026-06-18_rtv_cold_article_fields.sql`
Expected: `ALTER TABLE` printed 4 times, no errors.

- [ ] **Step 3: Verify columns exist**

Run: `psql "$DATABASE_URL" -c "\d cfpl_rtv_lines" | grep -E 'lot_number|item_mark|spl_remarks|vakkal'`
Expected: all four column names listed.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-06-18_rtv_cold_article_fields.sql
git commit -m "feat(rtv): add cold per-article columns to rtv lines/boxes"
```

---

### Task 2: Backend models — cold fields + bulk-box models

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_models.py`
- Test: `c:\Backup\backend\test_rtv_cold_fields.py`

- [ ] **Step 1: Write the failing test** (dependency-free, mirrors `test_approve_inward_cold_fields.py:21-34`)

```python
"""Dependency-free: RTV models must retain the cold per-article fields.
Run: python test_rtv_cold_fields.py
"""
from services.ims_service.rtv_models import (
    RTVLineCreate, RTVBoxUpsertRequest, RTVApprovalLineFields,
    RTVApprovalBoxFields, RTVBulkBoxItem, RTVBulkBoxUpdateRequest,
)


def test_line_create_keeps_cold_fields():
    line = RTVLineCreate(
        material_type="rm", item_category="DATES", sub_category="KHALAS",
        item_description="al barakah khalas dates", uom="10",
        lot_number="7648", item_mark="MARK-1", spl_remarks="handle cold", vakkal="VK-99",
    )
    d = line.model_dump(exclude_none=True)
    for f in ("lot_number", "item_mark", "spl_remarks", "vakkal"):
        assert d[f], f"{f} dropped by RTVLineCreate"
    print("test_line_create_keeps_cold_fields: PASS")


def test_box_upsert_keeps_cold_fields():
    box = RTVBoxUpsertRequest(
        article_description="al barakah khalas dates", box_number=1,
        lot_number="7648", item_mark="MARK-1", spl_remarks="cold", vakkal="VK-99",
    )
    d = box.model_dump(exclude_none=True)
    for f in ("lot_number", "item_mark", "spl_remarks", "vakkal"):
        assert d[f], f"{f} dropped by RTVBoxUpsertRequest"
    print("test_box_upsert_keeps_cold_fields: PASS")


def test_approval_models_keep_cold_fields():
    line = RTVApprovalLineFields(item_description="x", lot_number="1", item_mark="m", spl_remarks="r", vakkal="v")
    box = RTVApprovalBoxFields(article_description="x", box_number=1, lot_number="1", item_mark="m", spl_remarks="r", vakkal="v")
    for f in ("lot_number", "item_mark", "spl_remarks", "vakkal"):
        assert line.model_dump(exclude_none=True)[f]
        assert box.model_dump(exclude_none=True)[f]
    print("test_approval_models_keep_cold_fields: PASS")


def test_bulk_box_request_keeps_cold_fields():
    req = RTVBulkBoxUpdateRequest(boxes=[RTVBulkBoxItem(
        article_description="x", box_number=1, lot_number="1",
        item_mark="m", spl_remarks="r", vakkal="v", net_weight="1.0", gross_weight="1.2",
    )])
    d = req.boxes[0].model_dump(exclude_none=True)
    for f in ("lot_number", "item_mark", "spl_remarks", "vakkal"):
        assert d[f], f"{f} dropped by RTVBulkBoxItem"
    print("test_bulk_box_request_keeps_cold_fields: PASS")


if __name__ == "__main__":
    test_line_create_keeps_cold_fields()
    test_box_upsert_keeps_cold_fields()
    test_approval_models_keep_cold_fields()
    test_bulk_box_request_keeps_cold_fields()
    print("ALL PASS")
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: ImportError (`RTVBulkBoxItem` / `RTVBulkBoxUpdateRequest` not defined) or AssertionError on the new fields.

- [ ] **Step 3: Add cold fields to `RTVLineCreate`** (after `carton_weight`, `rtv_models.py:44`)

```python
    net_weight: Optional[str] = "0"
    carton_weight: Optional[str] = "0"
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 4: Add cold fields to `RTVLineResponse`** (after `carton_weight`, `rtv_models.py:168`)

```python
    net_weight: str
    carton_weight: str
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 5: Add cold fields to `RTVBoxUpsertRequest`** (after existing `lot_number`, `rtv_models.py:82`)

```python
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
    count: Optional[int] = None
```

- [ ] **Step 6: Add cold fields to `RTVBoxResponse`** (after existing `lot_number`, `rtv_models.py:182`)

```python
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 7: Add cold fields to `RTVApprovalLineFields`** (append, `rtv_models.py:115`)

```python
    sub_category: Optional[str] = None
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 8: Add cold fields to `RTVApprovalBoxFields`** (append, `rtv_models.py:125`)

```python
    count: Optional[int] = None
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
```

- [ ] **Step 9: Add the new bulk-box models** (insert after `RTVBoxUpsertResponse`, around `rtv_models.py:196`)

```python
class RTVBulkBoxItem(BaseModel):
    article_description: str
    box_number: int = Field(..., ge=1)
    uom: Optional[str] = None
    conversion: Optional[str] = None
    lot_number: Optional[str] = None
    item_mark: Optional[str] = None
    spl_remarks: Optional[str] = None
    vakkal: Optional[str] = None
    net_weight: Optional[Decimal18_3] = None
    gross_weight: Optional[Decimal18_3] = None
    count: Optional[int] = None


class RTVBulkBoxUpdateRequest(BaseModel):
    boxes: List[RTVBulkBoxItem] = Field(default_factory=list)


class RTVBulkBoxUpdateResponse(BaseModel):
    status: str
    rtv_id: str
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    deleted: int = 0
```

- [ ] **Step 10: Run the test, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `ALL PASS`

- [ ] **Step 11: Commit**

```bash
git add services/ims_service/rtv_models.py test_rtv_cold_fields.py
git commit -m "feat(rtv): cold fields on line/box/approval models + bulk-box models"
```

---

### Task 3: Backend — persist & return cold line fields (create + fetch + update_lines)

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_tools.py`
- Test: `c:\Backup\backend\test_rtv_cold_fields.py` (extend)

- [ ] **Step 1: Add a failing test** that asserts `create_rtv` and `update_rtv_lines` write the cold columns. Append to `test_rtv_cold_fields.py`:

```python
from sqlalchemy import text  # noqa: E402
from services.ims_service import rtv_tools  # noqa: E402
from services.ims_service.rtv_models import RTVCreate, RTVHeaderCreate, RTVLinesUpdateRequest  # noqa: E402


class _Row:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class CaptureDB:
    """Records every execute() (sql, params). Returns a header row with id=1 for INSERT...RETURNING."""
    def __init__(self):
        self.calls = []

    def execute(self, clause, params=None):
        sql = str(clause)
        self.calls.append((sql, params or {}))

        class R:
            def __init__(self, row=None):
                self._row = row
            def fetchone(self):
                return self._row
            def fetchall(self):
                return [self._row] if self._row else []
        if "INTO" in sql and "rtv_header" in sql:
            return R(_Row(id=1, rtv_id="RTV-X", rtv_date=None, factory_unit=(params or {}).get("factory_unit"),
                          customer="c", invoice_number=None, challan_no=None, dn_no=None, conversion=0,
                          sales_poc=None, business_head=None, remark=None, status="Pending", created_by="t",
                          created_ts=None, updated_at=None, vehicle_number=None, transporter_name=None,
                          driver_name=None, inward_manager=None))
        if "INTO" in sql and "rtv_lines" in sql:
            return R(_Row(id=10, header_id=1, material_type="RM", item_category="DATES", sub_category="KHALAS",
                          item_description="x", uom="10", qty=0, rate=0, value=0, net_weight=0, carton_weight=0,
                          lot_number=(params or {}).get("lot_number"), item_mark=(params or {}).get("item_mark"),
                          spl_remarks=(params or {}).get("spl_remarks"), vakkal=(params or {}).get("vakkal"),
                          created_at=None, updated_at=None))
        return R(None)

    def commit(self):
        pass


def _line_insert_params(db):
    return [p for s, p in db.calls if "INTO" in s and "rtv_lines" in s][0]


def test_create_rtv_writes_cold_line_fields():
    db = CaptureDB()
    data = RTVCreate(company="CFPL",
        header=RTVHeaderCreate(factory_unit="Savla D-39", customer="c"),
        lines=[RTVLineCreate(material_type="rm", item_category="DATES", sub_category="KHALAS",
            item_description="x", uom="10", lot_number="7648", item_mark="M", spl_remarks="R", vakkal="V")])
    rtv_tools.create_rtv(data, "tester", db)
    p = _line_insert_params(db)
    assert p["lot_number"] == "7648" and p["item_mark"] == "M" and p["spl_remarks"] == "R" and p["vakkal"] == "V"
    assert "lot_number" in [s for s, _ in db.calls if "rtv_lines" in s and "INTO" in s][0]
    print("test_create_rtv_writes_cold_line_fields: PASS")
```

(Add the two new function calls to the `__main__` block.)

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `KeyError: 'lot_number'` (the INSERT params dict has no cold keys yet).

- [ ] **Step 3: Update `_map_line_row`** (`rtv_tools.py:74-90`) — add the four keys before `created_at`:

```python
        "net_weight": str(row.net_weight) if row.net_weight is not None else "0",
        "carton_weight": str(row.carton_weight) if row.carton_weight is not None else "0",
        "lot_number": getattr(row, "lot_number", None),
        "item_mark": getattr(row, "item_mark", None),
        "spl_remarks": getattr(row, "spl_remarks", None),
        "vakkal": getattr(row, "vakkal", None),
        "created_at": row.created_at,
```

- [ ] **Step 4: Update `_fetch_lines` SELECT** (`rtv_tools.py:114-121`)

```python
            SELECT id, header_id, material_type, item_category, sub_category,
                   item_description, uom, qty, rate, value, net_weight, carton_weight,
                   lot_number, item_mark, spl_remarks, vakkal,
                   created_at, updated_at
            FROM {tables['lines']}
            WHERE header_id = :hid
            ORDER BY id
```

- [ ] **Step 5: Update `create_rtv` line INSERT** (`rtv_tools.py:223-247`) — columns, values, and params:

```python
            text(f"""
                INSERT INTO {tables['lines']}
                    (header_id, material_type, item_category, sub_category,
                     item_description, uom, qty, rate, value, net_weight, carton_weight,
                     lot_number, item_mark, spl_remarks, vakkal)
                VALUES
                    (:header_id, :material_type, :item_category, :sub_category,
                     :item_description, :uom, :qty, :rate, :value, :net_weight, :carton_weight,
                     :lot_number, :item_mark, :spl_remarks, :vakkal)
                RETURNING id, header_id, material_type, item_category, sub_category,
                          item_description, uom, qty, rate, value, net_weight, carton_weight,
                          lot_number, item_mark, spl_remarks, vakkal,
                          created_at, updated_at
            """),
            {
                "header_id": header_id,
                "material_type": line.material_type,
                "item_category": line.item_category,
                "sub_category": line.sub_category,
                "item_description": line.item_description,
                "uom": line.uom,
                "qty": qty_i,
                "rate": rate_f,
                "value": value_f,
                "net_weight": net_weight_f,
                "carton_weight": carton_weight_f,
                "lot_number": line.lot_number,
                "item_mark": line.item_mark,
                "spl_remarks": line.spl_remarks,
                "vakkal": line.vakkal,
            },
```

- [ ] **Step 6: Apply the same column/value/param additions to `update_rtv_lines` INSERT** (`rtv_tools.py:623-643`). Use the identical 4 columns, 4 `:params`, and the same `"lot_number": line.lot_number, ...` param lines (no `RETURNING` needed here).

- [ ] **Step 7: Run, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `ALL PASS`

- [ ] **Step 8: Commit**

```bash
git add services/ims_service/rtv_tools.py test_rtv_cold_fields.py
git commit -m "feat(rtv): persist & return cold fields on lines (create + update + fetch)"
```

---

### Task 4: Backend — persist & return cold box fields (upsert + fetch)

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_tools.py`
- Test: `c:\Backup\backend\test_rtv_cold_fields.py` (extend)

- [ ] **Step 1: Add a failing test** for `upsert_rtv_box`. Append:

```python
from services.ims_service.rtv_models import RTVBoxUpsertRequest  # noqa: E402,F811


class BoxDB:
    """No existing box → forces the INSERT branch. Records INSERT (sql, params)."""
    def __init__(self):
        self.calls = []
    def execute(self, clause, params=None):
        sql = str(clause); self.calls.append((sql, params or {}))
        class R:
            def __init__(self, row): self._row = row
            def fetchone(self): return self._row
        if "SELECT id, rtv_id FROM" in sql:   # header lookup
            return R(_Row(id=1, rtv_id="RTV-X"))
        if "SELECT id FROM" in sql:           # line FK lookup
            return R(_Row(id=10))
        if "SELECT id, box_id FROM" in sql:   # existing box lookup
            return R(None)
        return R(None)
    def commit(self): pass


def test_upsert_box_writes_cold_fields():
    db = BoxDB()
    payload = RTVBoxUpsertRequest(article_description="x", box_number=1,
        lot_number="7648", item_mark="M", spl_remarks="R", vakkal="V",
        net_weight="1.0", gross_weight="1.2", count=2)
    rtv_tools.upsert_rtv_box("CFPL", 1, payload, db)
    ins = [(s, p) for s, p in db.calls if "INTO" in s and "rtv_boxes" in s][0]
    sql, p = ins
    for f in ("item_mark", "spl_remarks", "vakkal", "lot_number"):
        assert f in sql, f"{f} missing from INSERT columns"
        assert p[f] in ("7648", "M", "R", "V")
    print("test_upsert_box_writes_cold_fields: PASS")
```

(Add to `__main__`.)

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `KeyError: 'item_mark'` or assertion that `item_mark` not in INSERT SQL.

- [ ] **Step 3: Update `_map_box_row`** (`rtv_tools.py:93-109`) — add after `lot_number`:

```python
        "lot_number": row.lot_number,
        "item_mark": getattr(row, "item_mark", None),
        "spl_remarks": getattr(row, "spl_remarks", None),
        "vakkal": getattr(row, "vakkal", None),
        "net_weight": str(row.net_weight) if row.net_weight is not None else "0",
```

- [ ] **Step 4: Update `_fetch_boxes` SELECT** (`rtv_tools.py:130-135`)

```python
            SELECT id, header_id, rtv_line_id, box_number, box_id,
                   article_description, uom, conversion, lot_number,
                   item_mark, spl_remarks, vakkal,
                   net_weight, gross_weight, count, created_at, updated_at
```

- [ ] **Step 5: Extend `upsert_rtv_box` params dict** (`rtv_tools.py:508-519`) — add 3 keys:

```python
        "lot_number": payload.lot_number,
        "item_mark": payload.item_mark,
        "spl_remarks": payload.spl_remarks,
        "vakkal": payload.vakkal,
        "count": payload.count,
```

- [ ] **Step 6: Add the 3 cold fields to BOTH UPDATE branches** (`rtv_tools.py:526-531` and `551-556`) — insert after the `lot_number = COALESCE(...)` line in each:

```python
                    lot_number = COALESCE(:lot_number, lot_number),
                    item_mark = COALESCE(:item_mark, item_mark),
                    spl_remarks = COALESCE(:spl_remarks, spl_remarks),
                    vakkal = COALESCE(:vakkal, vakkal),
                    count = COALESCE(:count, count),
```

- [ ] **Step 7: Add the 3 cold fields to the INSERT branch** (`rtv_tools.py:566-575`)

```python
                    INSERT INTO {tables['boxes']}
                        (header_id, rtv_line_id, box_number, box_id,
                         article_description, uom, conversion, lot_number,
                         item_mark, spl_remarks, vakkal,
                         net_weight, gross_weight, count)
                    VALUES
                        (:hid, :line_id, :box_num, :box_id,
                         :art_desc, :uom, :conversion, :lot_number,
                         :item_mark, :spl_remarks, :vakkal,
                         :net_weight, :gross_weight, :count)
```

- [ ] **Step 8: Run, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `ALL PASS`

- [ ] **Step 9: Commit**

```bash
git add services/ims_service/rtv_tools.py test_rtv_cold_fields.py
git commit -m "feat(rtv): persist & return cold fields on boxes (upsert + fetch)"
```

---

### Task 5: Backend — bulk-boxes endpoint + tool (NEW; the FE already calls it)

The frontend's `rtvApi.bulkSaveBoxes` calls `PUT /rtv/{company}/{rtv_id}/boxes`, but **no such route or tool exists** today. Implement a state-aware sync: insert new, update changed, delete removed, preserving `box_id` on matched rows.

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_tools.py`
- Modify: `c:\Backup\backend\services\ims_service\rtv_server.py`
- Test: `c:\Backup\backend\test_rtv_bulk_boxes.py`

- [ ] **Step 1: Write the failing test**

```python
"""Dependency-free: bulk_save_boxes inserts new boxes (with cold fields) and
deletes boxes no longer present. Run: python test_rtv_bulk_boxes.py
"""
from services.ims_service import rtv_tools
from services.ims_service.rtv_models import RTVBulkBoxUpdateRequest, RTVBulkBoxItem


class _Row:
    def __init__(self, **kw): self.__dict__.update(kw)


class BulkDB:
    def __init__(self, existing):
        self.existing = existing          # list of _Row(box_number, box_id, article_description)
        self.calls = []
    def execute(self, clause, params=None):
        sql = str(clause); self.calls.append((sql, params or {}))
        class R:
            def __init__(self, rows): self._rows = rows
            def fetchone(self): return self._rows[0] if self._rows else None
            def fetchall(self): return self._rows
        if "SELECT id, rtv_id FROM" in sql:
            return R([_Row(id=1, rtv_id="RTV-X")])
        if "FROM" in sql and "rtv_boxes" in sql and "SELECT" in sql:
            return R(self.existing)
        if "SELECT id FROM" in sql:        # line FK lookup
            return R([_Row(id=10)])
        return R([])
    def commit(self): pass


def test_bulk_save_inserts_and_deletes():
    existing = [_Row(box_number=1, box_id="b1", article_description="x"),
                _Row(box_number=2, box_id="b2", article_description="x")]
    db = BulkDB(existing)
    req = RTVBulkBoxUpdateRequest(boxes=[
        RTVBulkBoxItem(article_description="x", box_number=1, lot_number="L1",
                       item_mark="M", spl_remarks="R", vakkal="V", net_weight="1.0", gross_weight="1.2"),
        RTVBulkBoxItem(article_description="x", box_number=3, lot_number="L3",
                       item_mark="M3", net_weight="2.0", gross_weight="2.3"),
    ])
    res = rtv_tools.bulk_save_boxes("CFPL", 1, req, db, notify_discrepancy=False)
    assert res["inserted"] >= 1                       # box 3 new
    assert res["deleted"] >= 1                        # box 2 removed
    ins = [(s, p) for s, p in db.calls if "INTO" in s and "rtv_boxes" in s]
    assert any("item_mark" in s for s, _ in ins), "cold fields not in bulk INSERT"
    print("test_bulk_save_inserts_and_deletes: PASS")


if __name__ == "__main__":
    test_bulk_save_inserts_and_deletes()
    print("ALL PASS")
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_bulk_boxes.py`
Expected: `AttributeError: module 'rtv_tools' has no attribute 'bulk_save_boxes'`.

- [ ] **Step 3: Implement `bulk_save_boxes`** in `rtv_tools.py` (insert after `upsert_rtv_box`, ~line 587). Imports `RTVBulkBoxUpdateRequest` — add it to the model import block at the top (`rtv_tools.py:11-18`).

```python
def bulk_save_boxes(
    company: Company, rtv_id_int: int, data, db: Session, notify_discrepancy: bool = True
) -> dict:
    """State-aware full sync of the box set for a CR. Insert new, update existing
    (preserving box_id), delete boxes no longer present. Persists cold fields."""
    tables = rtv_table_names(company)

    header = db.execute(
        text(f"SELECT id, rtv_id FROM {tables['header']} WHERE id = :hid"),
        {"hid": rtv_id_int},
    ).fetchone()
    if not header:
        raise HTTPException(404, "RTV not found")

    existing_rows = db.execute(
        text(f"""SELECT box_number, box_id, article_description
                 FROM {tables['boxes']} WHERE header_id = :hid"""),
        {"hid": rtv_id_int},
    ).fetchall()
    existing_keys = {(r.article_description, r.box_number): r.box_id for r in existing_rows}
    incoming_keys = {(b.article_description, b.box_number) for b in data.boxes}

    inserted = updated = 0
    for b in data.boxes:
        line = db.execute(
            text(f"SELECT id FROM {tables['lines']} WHERE header_id = :hid AND item_description = :art LIMIT 1"),
            {"hid": rtv_id_int, "art": b.article_description},
        ).fetchone()
        params = {
            "hid": rtv_id_int,
            "line_id": line.id if line else None,
            "art_desc": b.article_description,
            "box_num": b.box_number,
            "uom": b.uom,
            "conversion": b.conversion,
            "lot_number": b.lot_number,
            "item_mark": b.item_mark,
            "spl_remarks": b.spl_remarks,
            "vakkal": b.vakkal,
            "net_weight": float(b.net_weight) if b.net_weight is not None else None,
            "gross_weight": float(b.gross_weight) if b.gross_weight is not None else None,
            "count": b.count,
        }
        if (b.article_description, b.box_number) in existing_keys:
            db.execute(text(f"""
                UPDATE {tables['boxes']}
                SET uom = COALESCE(:uom, uom),
                    conversion = COALESCE(:conversion, conversion),
                    lot_number = COALESCE(:lot_number, lot_number),
                    item_mark = COALESCE(:item_mark, item_mark),
                    spl_remarks = COALESCE(:spl_remarks, spl_remarks),
                    vakkal = COALESCE(:vakkal, vakkal),
                    net_weight = COALESCE(:net_weight, net_weight),
                    gross_weight = COALESCE(:gross_weight, gross_weight),
                    count = COALESCE(:count, count),
                    rtv_line_id = :line_id, updated_at = NOW()
                WHERE header_id = :hid AND article_description = :art_desc AND box_number = :box_num
            """), params)
            updated += 1
        else:
            base = str(int(time.time() * 1000))[-8:]
            params["box_id"] = f"{base}-{b.box_number}"
            db.execute(text(f"""
                INSERT INTO {tables['boxes']}
                    (header_id, rtv_line_id, box_number, box_id, article_description,
                     uom, conversion, lot_number, item_mark, spl_remarks, vakkal,
                     net_weight, gross_weight, count)
                VALUES
                    (:hid, :line_id, :box_num, :box_id, :art_desc,
                     :uom, :conversion, :lot_number, :item_mark, :spl_remarks, :vakkal,
                     :net_weight, :gross_weight, :count)
            """), params)
            inserted += 1

    deleted = 0
    for (art, num) in existing_keys.keys() - incoming_keys:
        db.execute(
            text(f"""DELETE FROM {tables['boxes']}
                     WHERE header_id = :hid AND article_description = :art AND box_number = :num"""),
            {"hid": rtv_id_int, "art": art, "num": num},
        )
        deleted += 1

    return {
        "status": "synced",
        "rtv_id": header.rtv_id,
        "inserted": inserted,
        "updated": updated,
        "unchanged": 0,
        "deleted": deleted,
    }
```

- [ ] **Step 4: Add the route** in `rtv_server.py` (insert after the `/box` endpoint, ~line 422). Confirm the existing import line for tools/models and add `bulk_save_boxes` + `RTVBulkBoxUpdateRequest`/`RTVBulkBoxUpdateResponse`.

```python
@router.put("/{company}/{rtv_id}/boxes", response_model=RTVBulkBoxUpdateResponse)
def bulk_save_boxes_endpoint(
    company: Company,
    rtv_id: int,
    payload: RTVBulkBoxUpdateRequest,
    notify_discrepancy: bool = True,
    db: Session = Depends(get_db),
):
    result = bulk_save_boxes(company, rtv_id, payload, db, notify_discrepancy=notify_discrepancy)
    db.commit()
    return result
```

(Match the exact `get_db`/`Depends`/`Session` import style already used by `upsert_rtv_box_endpoint` at `rtv_server.py:413-421`.)

- [ ] **Step 5: Run the test, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_bulk_boxes.py`
Expected: `ALL PASS`

- [ ] **Step 6: Smoke-check the route is registered**

Run: `cd c:\Backup\backend && python -c "from services.ims_service.rtv_server import router; print([r.path for r in router.routes if r.path.endswith('/boxes')])"`
Expected: `['/{company}/{rtv_id}/boxes']`

- [ ] **Step 7: Commit**

```bash
git add services/ims_service/rtv_tools.py services/ims_service/rtv_server.py test_rtv_bulk_boxes.py
git commit -m "feat(rtv): implement bulk box sync endpoint (PUT /{company}/{id}/boxes) with cold fields"
```

---

### Task 6: Backend — cold fields + lot in `approve_rtv` box write

`approve_rtv`'s line UPDATE loop (`rtv_tools.py:705-730`) already iterates `model_dump(exclude_none=True)` fields generically, so cold line fields persist once the model has them (Task 2) — but its **box** INSERT/UPDATE (`rtv_tools.py:733-781`) omits `lot_number` and the cold fields. Fix it.

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_tools.py`
- Test: `c:\Backup\backend\test_rtv_cold_fields.py` (extend)

- [ ] **Step 1: Add a failing test** asserting the approve box INSERT includes the cold columns. Append:

```python
from services.ims_service.rtv_models import RTVApprovalRequest, RTVApprovalBoxFields  # noqa: E402


class ApproveDB:
    def __init__(self): self.calls = []
    def execute(self, clause, params=None):
        sql = str(clause); self.calls.append((sql, params or {}))
        class R:
            def __init__(self, row): self._row = row
            def fetchone(self): return self._row
        if "SELECT id, rtv_id, status FROM" in sql:
            return R(_Row(id=1, rtv_id="RTV-X", status="Pending"))
        if "SELECT box_id FROM" in sql:
            return R(None)   # force INSERT branch
        return R(None)
    def commit(self): pass


def test_approve_box_insert_has_cold_fields():
    db = ApproveDB()
    payload = RTVApprovalRequest(approved_by="t", boxes=[RTVApprovalBoxFields(
        article_description="x", box_number=1, lot_number="L1",
        item_mark="M", spl_remarks="R", vakkal="V", net_weight="1.0", gross_weight="1.2")])
    rtv_tools.approve_rtv("CFPL", 1, payload, db)
    ins = [s for s, _ in db.calls if "INTO" in s and "rtv_boxes" in s][0]
    for f in ("lot_number", "item_mark", "spl_remarks", "vakkal"):
        assert f in ins, f"{f} missing from approve box INSERT"
    print("test_approve_box_insert_has_cold_fields: PASS")
```

(Add to `__main__`.)

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: assertion `lot_number missing from approve box INSERT`.

- [ ] **Step 3: Extend the approve box `box_params`** (`rtv_tools.py:735-744`)

```python
            box_params = {
                "hid": rtv_id_int,
                "art_desc": b.article_description,
                "box_num": b.box_number,
                "uom": b.uom,
                "conversion": b.conversion,
                "lot_number": b.lot_number,
                "item_mark": b.item_mark,
                "spl_remarks": b.spl_remarks,
                "vakkal": b.vakkal,
                "net_weight": float(b.net_weight) if b.net_weight is not None else None,
                "gross_weight": float(b.gross_weight) if b.gross_weight is not None else None,
                "count": b.count,
            }
```

- [ ] **Step 4: Add cold fields to the approve box UPDATE** (`rtv_tools.py:758-764`) — after `conversion = COALESCE(...)`:

```python
                        SET uom = COALESCE(:uom, uom),
                            conversion = COALESCE(:conversion, conversion),
                            lot_number = COALESCE(:lot_number, lot_number),
                            item_mark = COALESCE(:item_mark, item_mark),
                            spl_remarks = COALESCE(:spl_remarks, spl_remarks),
                            vakkal = COALESCE(:vakkal, vakkal),
                            net_weight = COALESCE(:net_weight, net_weight),
                            gross_weight = COALESCE(:gross_weight, gross_weight),
                            count = COALESCE(:count, count),
                            updated_at = NOW()
```

- [ ] **Step 5: Add cold fields to the approve box INSERT** (`rtv_tools.py:771-781`)

```python
                    text(f"""
                        INSERT INTO {tables['boxes']}
                            (header_id, box_number, article_description,
                             uom, conversion, lot_number, item_mark, spl_remarks, vakkal,
                             net_weight, gross_weight, count)
                        VALUES
                            (:hid, :box_num, :art_desc,
                             :uom, :conversion, :lot_number, :item_mark, :spl_remarks, :vakkal,
                             :net_weight, :gross_weight, :count)
                    """),
```

- [ ] **Step 6: Run, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py`
Expected: `ALL PASS`

- [ ] **Step 7: Commit**

```bash
git add services/ims_service/rtv_tools.py test_rtv_cold_fields.py
git commit -m "feat(rtv): persist lot + cold fields in approve_rtv box write"
```

---

### Task 7: Backend — canonicalize `factory_unit` on write

Store canonical warehouse codes so `cold_stocks` cross-linking (Phase 2) and any dashboard grouping key correctly. Defensive: the FE will send canonical codes after Task 9, but API/legacy callers may not.

**Files:**
- Modify: `c:\Backup\backend\services\ims_service\rtv_tools.py`
- Test: `c:\Backup\backend\test_rtv_canonical_warehouse.py`

- [ ] **Step 1: Write the failing test**

```python
"""Dependency-free: factory_unit is canonicalized on create.
Run: python test_rtv_canonical_warehouse.py
"""
from services.ims_service import rtv_tools


def test_canonical_factory_unit_maps_alias():
    # backend WAREHOUSE_ALIASES maps "new savla" -> "Savla D-514", "d-39" -> "Savla D-39"
    assert rtv_tools._canonical_factory_unit("new savla") == "Savla D-514"
    assert rtv_tools._canonical_factory_unit("D-39") == "Savla D-39"
    assert rtv_tools._canonical_factory_unit("Savla D-39") == "Savla D-39"


def test_canonical_factory_unit_passes_through_unknown():
    # bare "Savla" is not in backend aliases → fall back to the raw value (display-time mapping handles it)
    assert rtv_tools._canonical_factory_unit("Savla") == "Savla"
    assert rtv_tools._canonical_factory_unit("W202") == "W202"
    assert rtv_tools._canonical_factory_unit("") == ""
    assert rtv_tools._canonical_factory_unit(None) is None


if __name__ == "__main__":
    test_canonical_factory_unit_maps_alias()
    test_canonical_factory_unit_passes_through_unknown()
    print("ALL PASS")
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\backend && python test_rtv_canonical_warehouse.py`
Expected: `AttributeError: module 'rtv_tools' has no attribute '_canonical_factory_unit'`.

- [ ] **Step 3: Add the helper** to `rtv_tools.py` (after `_generate_rtv_id`, ~line 40). Add the import at top: `from shared.canonicalize import canonical_warehouse`.

```python
def _canonical_factory_unit(raw):
    """Map a factory_unit string to its canonical warehouse code, or return it
    unchanged if unrecognized (display-time mapping handles legacy values)."""
    if not raw:
        return raw
    return canonical_warehouse(raw, raw) or raw
```

- [ ] **Step 4: Apply it in `create_rtv`** — change the header param (`rtv_tools.py:195`):

```python
            "factory_unit": _canonical_factory_unit(data.header.factory_unit),
```

- [ ] **Step 5: Apply it in `approve_rtv` header merge** (`rtv_tools.py:685-693`) — special-case `factory_unit` like `conversion`:

```python
        for field, value in header_data.items():
            if field == "conversion":
                update_parts.append(f"{field} = :{field}")
                params[field] = float(value) if value else 0
            elif field == "factory_unit":
                update_parts.append(f"{field} = :{field}")
                params[field] = _canonical_factory_unit(value)
            else:
                update_parts.append(f"{field} = :{field}")
                params[field] = value
```

- [ ] **Step 6: Run, verify it passes**

Run: `cd c:\Backup\backend && python test_rtv_canonical_warehouse.py`
Expected: `ALL PASS`

- [ ] **Step 7: Re-run the full backend suite for this feature**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py && python test_rtv_bulk_boxes.py && python test_rtv_canonical_warehouse.py`
Expected: each prints `ALL PASS`.

- [ ] **Step 8: Commit**

```bash
git add services/ims_service/rtv_tools.py test_rtv_canonical_warehouse.py
git commit -m "feat(rtv): canonicalize factory_unit on create + approve"
```

---

### Task 8: Frontend types — cold fields on RTV interfaces

**Files:**
- Modify: `c:\Backup\frontend\types\rtv.ts`

- [ ] **Step 1: Add cold fields to `RTVLine`** (after `net_weight`, `types/rtv.ts:91`)

```ts
  net_weight: string | null
  lot_number?: string | null
  item_mark?: string | null
  spl_remarks?: string | null
  vakkal?: string | null
  created_at: string | null
```

- [ ] **Step 2: Add cold fields to `RTVLineCreate`** (after `net_weight`, `types/rtv.ts:108`)

```ts
  net_weight?: string
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
```

- [ ] **Step 3: Add cold fields to `RTVBox`** (after `lot_number`, `types/rtv.ts:120`)

```ts
  lot_number: string | null
  item_mark?: string | null
  spl_remarks?: string | null
  vakkal?: string | null
```

- [ ] **Step 4: Add cold fields to `RTVBoxUpsertRequest`** (after `lot_number`, `types/rtv.ts:137`)

```ts
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
  count?: number
```

- [ ] **Step 5: Add cold fields to `RTVBulkBoxItem`** (after `lot_number`, `types/rtv.ts:160`)

```ts
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
  net_weight?: string
```

- [ ] **Step 6: Add cold fields to `RTVApprovalLineFields`** (append before closing brace, `types/rtv.ts:288`) and `RTVApprovalBoxFields` (after `lot_number`, `types/rtv.ts:297`)

```ts
  // RTVApprovalLineFields:
  sale_group?: string
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
```
```ts
  // RTVApprovalBoxFields:
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
  count?: number
```

- [ ] **Step 7: Type-check**

Run: `cd c:\Backup\frontend && npx tsc --noEmit`
Expected: no new errors referencing `types/rtv.ts`.

- [ ] **Step 8: Commit**

```bash
git add types/rtv.ts
git commit -m "feat(rtv): cold fields on RTV TS interfaces"
```

---

### Task 9: Frontend — shared `WarehouseSelect` + replace hardcoded lists

**Files:**
- Create: `c:\Backup\frontend\components\modules\warehouse\WarehouseSelect.tsx`
- Create: `c:\Backup\frontend\components\modules\warehouse\__tests__\WarehouseSelect.test.tsx`
- Modify: `c:\Backup\frontend\app\[company]\reordering\new\page.tsx`
- Modify: `c:\Backup\frontend\app\[company]\reordering\[id]\approve\page.tsx`

- [ ] **Step 1: Write the failing test** (vitest + RTL)

```tsx
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { WarehouseSelect } from "../WarehouseSelect"

describe("WarehouseSelect", () => {
  it("renders the canonical cold warehouse codes as values", () => {
    render(<WarehouseSelect value="Savla D-39" onChange={() => {}} />)
    // The trigger shows the display label for the selected canonical code
    expect(screen.getByText(/Savla D-39/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\frontend && npm run test -- WarehouseSelect`
Expected: FAIL — cannot resolve `../WarehouseSelect`.

- [ ] **Step 3: Implement `WarehouseSelect.tsx`** — options from the shared constant, value = canonical code, label = display name.

```tsx
"use client"

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { WAREHOUSES, getWarehouseName } from "@/lib/constants/warehouses"

interface WarehouseSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Restrict to cold warehouses only. Defaults to showing all. */
  coldOnly?: boolean
}

export function WarehouseSelect({
  value, onChange, placeholder = "Select factory", className = "h-9", coldOnly = false,
}: WarehouseSelectProps) {
  const codes = Object.entries(WAREHOUSES)
    .filter(([, w]) => (coldOnly ? w.type === "cold" : true))
    .map(([code]) => code)

  // Preserve a legacy/unknown stored value so the control still shows it.
  const showLegacy = value && !codes.includes(value)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showLegacy && <SelectItem value={value}>{getWarehouseName(value)}</SelectItem>}
        {codes.map((code) => (
          <SelectItem key={code} value={code}>{getWarehouseName(code)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `cd c:\Backup\frontend && npm run test -- WarehouseSelect`
Expected: PASS.

- [ ] **Step 5: Replace the hardcoded list in `new/page.tsx`** — swap lines 647-656 (the `<Select value={factoryUnit}...>` block) for:

```tsx
                <WarehouseSelect value={factoryUnit} onChange={setFactoryUnit} />
```
Add the import near the other component imports: `import { WarehouseSelect } from "@/components/modules/warehouse/WarehouseSelect"`.

- [ ] **Step 6: Replace the hardcoded list in `approve/page.tsx`** — swap lines 739-748 for the same `<WarehouseSelect value={factoryUnit} onChange={setFactoryUnit} />` and add the import.

- [ ] **Step 7: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds; no errors in the two pages.

- [ ] **Step 8: Commit**

```bash
git add components/modules/warehouse/ app/[company]/reordering/new/page.tsx app/[company]/reordering/[id]/approve/page.tsx
git commit -m "feat(rtv): canonical WarehouseSelect on reordering new + approve"
```

---

### Task 10: Frontend — pure cold helpers (cascade / lot-range / bulk-fill)

Extract the box-mutation logic into tested pure functions reused by the approve + detail pages.

**Files:**
- Create: `c:\Backup\frontend\lib\utils\rtvCold.ts`
- Create: `c:\Backup\frontend\lib\utils\__tests__\rtvCold.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest"
import { cascadeArticleField, applyLotRanges, bulkFillBoxes, type ColdBox } from "../rtvCold"

const mk = (n: number, art = "x"): ColdBox => ({
  article_description: art, box_number: n, conversion: "", net_weight: "", gross_weight: "",
  count: "1", lot_number: "", item_mark: "", spl_remarks: "", vakkal: "", is_printed: false,
})

describe("rtvCold", () => {
  it("cascades an article field to all boxes of that article only", () => {
    const boxes = [mk(1, "x"), mk(2, "x"), mk(1, "y")]
    const out = cascadeArticleField(boxes, "x", "item_mark", "MARK")
    expect(out.filter(b => b.article_description === "x").every(b => b.item_mark === "MARK")).toBe(true)
    expect(out.find(b => b.article_description === "y")!.item_mark).toBe("")
  })

  it("applies lot ranges by box number for one article", () => {
    const boxes = [mk(1), mk(2), mk(3)]
    const out = applyLotRanges(boxes, "x", [{ from: 1, to: 2, lot: "7648" }])
    expect(out.map(b => b.lot_number)).toEqual(["7648", "7648", ""])
  })

  it("bulk-fills net/gross/count across an article's boxes", () => {
    const boxes = [mk(1), mk(2)]
    const out = bulkFillBoxes(boxes, "x", { net_weight: "1.5", gross_weight: "1.8", count: "2" })
    expect(out.every(b => b.net_weight === "1.5" && b.gross_weight === "1.8" && b.count === "2")).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `cd c:\Backup\frontend && npm run test -- rtvCold`
Expected: FAIL — cannot resolve `../rtvCold`.

- [ ] **Step 3: Implement `rtvCold.ts`**

```ts
export interface ColdBox {
  article_description: string
  box_number: number
  conversion: string
  net_weight: string
  gross_weight: string
  count: string
  lot_number: string
  item_mark: string
  spl_remarks: string
  vakkal: string
  box_id?: string
  is_printed: boolean
}

export interface LotRange { from: number; to: number; lot: string }

type CascadeField = "lot_number" | "item_mark" | "spl_remarks" | "vakkal"

export function cascadeArticleField(
  boxes: ColdBox[], article: string, field: CascadeField, value: string,
): ColdBox[] {
  return boxes.map((b) => (b.article_description === article ? { ...b, [field]: value } : b))
}

export function applyLotRanges(boxes: ColdBox[], article: string, ranges: LotRange[]): ColdBox[] {
  return boxes.map((b) => {
    if (b.article_description !== article) return b
    const match = ranges.find((r) => b.box_number >= r.from && b.box_number <= r.to)
    return match ? { ...b, lot_number: match.lot } : b
  })
}

export function bulkFillBoxes(
  boxes: ColdBox[], article: string,
  values: Partial<Pick<ColdBox, "net_weight" | "gross_weight" | "count">>,
): ColdBox[] {
  return boxes.map((b) => (b.article_description === article ? { ...b, ...values } : b))
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `cd c:\Backup\frontend && npm run test -- rtvCold`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/utils/rtvCold.ts lib/utils/__tests__/rtvCold.test.ts
git commit -m "feat(rtv): tested pure helpers for cold cascade / lot-range / bulk-fill"
```

---

### Task 11: Frontend — cold article fields on the NEW page

Capture article-level cold metadata at creation, gated to cold warehouses. Boxes stay locked (existing behaviour).

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\reordering\new\page.tsx`
- Reference (mirror layout): `app/[company]/inward/[id]/approve/page.tsx:1230-1248`

- [ ] **Step 1: Extend `RTVLineForm`** — the line form type comes from `@/components/modules/rtv/RTVLineEditor`. Add the cold fields to `emptyLine()` (`new/page.tsx:51-63`):

```tsx
const emptyLine = (): RTVLineForm => ({
  material_type: "", item_category: "", sub_category: "", item_description: "",
  sale_group: "", uom: "", qty: "", rate: "", value: "",
  carton_weight: "", net_weight: "",
  lot_number: "", item_mark: "", spl_remarks: "", vakkal: "",
})
```
If `RTVLineForm` is a typed interface in `RTVLineEditor.tsx`, add `lot_number?: string; item_mark?: string; spl_remarks?: string; vakkal?: string` to it.

- [ ] **Step 2: Import the cold-gate helper** — add to the imports:

```tsx
import { isColdWarehouse } from "@/lib/constants/warehouses"
```

- [ ] **Step 3: Render the cold fields** inside the article fields grid (after the `Net Wt (box sum)` field, `new/page.tsx:792-794`), gated on the selected factory unit:

```tsx
                      {isColdWarehouse(factoryUnit) && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Lot No</Label>
                            <Input value={line.lot_number || ""} onChange={(e) => updateLine(idx, "lot_number", e.target.value)} className="h-8 text-xs" placeholder="Lot no" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Item Mark</Label>
                            <Input value={line.item_mark || ""} onChange={(e) => updateLine(idx, "item_mark", e.target.value)} className="h-8 text-xs" placeholder="Item mark" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Spl. Remarks</Label>
                            <Input value={line.spl_remarks || ""} onChange={(e) => updateLine(idx, "spl_remarks", e.target.value)} className="h-8 text-xs" placeholder="Special remarks" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Vakkal</Label>
                            <Input value={line.vakkal || ""} onChange={(e) => updateLine(idx, "vakkal", e.target.value)} className="h-8 text-xs" placeholder="Vakkal" />
                          </div>
                        </>
                      )}
```
(`updateLine` already accepts `(idx, field, value)` and stores arbitrary keys via `{ ...l, [field]: value }` at `new/page.tsx:170` — no handler change needed.)

- [ ] **Step 4: Persist on create** — add the four fields to the `validLines.map(...)` payload (`new/page.tsx:144-157`):

```tsx
        net_weight: l.net_weight || "0",
        lot_number: l.lot_number || undefined,
        item_mark: l.item_mark || undefined,
        spl_remarks: l.spl_remarks || undefined,
        vakkal: l.vakkal || undefined,
```

- [ ] **Step 5: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual smoke** — `npm run dev`, open `/CFPL/reordering/new`, select **Savla D-39** → the 4 cold fields appear; select **W202** → they hide. Fill them, create, confirm via `GET /rtv/CFPL/{id}` the line carries them.

- [ ] **Step 7: Commit**

```bash
git add app/[company]/reordering/new/page.tsx components/modules/rtv/RTVLineEditor.tsx
git commit -m "feat(rtv): cold article fields on reordering new page (cold-gated)"
```

---

### Task 12: Frontend — cold fields + cascade + bulk box entry on the APPROVE page

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\reordering\[id]\approve\page.tsx`
- Uses: `lib/utils/rtvCold.ts` (Task 10)

- [ ] **Step 1: Extend the approve-page `BoxForm`** (`approve/page.tsx:44-54`) — add the cold fields so they match `ColdBox`:

```tsx
interface BoxForm {
  article_description: string
  box_number: number
  conversion: string
  net_weight: string
  gross_weight: string
  count: string
  lot_number: string
  item_mark: string
  spl_remarks: string
  vakkal: string
  box_id?: string
  is_printed: boolean
}
```

- [ ] **Step 2: Extend the line form + load from API** — add `lot_number/item_mark/spl_remarks/vakkal` to the line-form state shape and to the `data.lines` → form mapping in the load effect. Default each to `""`.

- [ ] **Step 3: Add cold article fields** to the article fields grid (after `Net Wt (box sum)`, `approve/page.tsx:862-865`), gated, identical markup to Task 11 Step 3 but using `updateLine` and cascading to boxes. Replace the plain `updateLine` for these four with a cascading variant:

```tsx
  const updateColdArticleField = (
    idx: number,
    field: "lot_number" | "item_mark" | "spl_remarks" | "vakkal",
    value: string,
  ) => {
    updateLine(idx, field, value)
    const art = lineForms[idx]?.item_description
    if (art) setBoxForms((prev) => cascadeArticleField(prev as ColdBox[], art, field, value) as BoxForm[])
  }
```
Add the import: `import { cascadeArticleField, applyLotRanges, bulkFillBoxes, type ColdBox } from "@/lib/utils/rtvCold"`.

- [ ] **Step 4: Wire `applyLotRanges`** — the page already renders `<LotRangeDedicator onApply={(ranges) => applyLotRanges(line.item_description, ranges)} />` at `approve/page.tsx:882-886`. Replace the page's local `applyLotRanges` body so it delegates to the helper:

```tsx
  const applyLotRanges = (article: string, ranges: LotRange[]) => {
    setBoxForms((prev) => applyLotRangesHelper(prev as ColdBox[], article, ranges) as BoxForm[])
  }
```
Import the helper under an alias to avoid the name clash: `import { applyLotRanges as applyLotRangesHelper } from "@/lib/utils/rtvCold"`.

- [ ] **Step 5: Add the bulk box entry control** — above the `BoxScrollContainer` (after the `LotRangeDedicator`, `approve/page.tsx:887`), gated on `boxesUnlocked`. State: `const [bulkFill, setBulkFill] = useState<Record<string, { net: string; gross: string; count: string }>>({})`.

```tsx
                  {boxesUnlocked && (
                    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Bulk fill boxes:</span>
                      <Input type="number" step="0.001" placeholder="Net wt" className="h-7 w-24 text-xs"
                        value={bulkFill[line.item_description]?.net || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), net: e.target.value } }))} />
                      <Input type="number" step="0.001" placeholder="Gross wt" className="h-7 w-24 text-xs"
                        value={bulkFill[line.item_description]?.gross || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), gross: e.target.value } }))} />
                      <Input type="number" placeholder="Count" className="h-7 w-20 text-xs"
                        value={bulkFill[line.item_description]?.count || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), count: e.target.value } }))} />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const v = bulkFill[line.item_description]
                          if (!v) return
                          setBoxForms((prev) => bulkFillBoxes(prev as ColdBox[], line.item_description, {
                            ...(v.net ? { net_weight: v.net } : {}),
                            ...(v.gross ? { gross_weight: v.gross } : {}),
                            ...(v.count ? { count: v.count } : {}),
                          }) as BoxForm[])
                        }}>
                        Apply to all
                      </Button>
                    </div>
                  )}
```

- [ ] **Step 6: Persist cold fields in bulk save** — extend the `rtvApi.bulkSaveBoxes` payload at `approve/page.tsx:643` so each box carries the cold fields:

```tsx
      await rtvApi.bulkSaveBoxes(company, rtvId, {
        boxes: boxForms.map((b) => ({
          article_description: b.article_description,
          box_number: b.box_number,
          conversion: b.conversion || undefined,
          lot_number: b.lot_number || undefined,
          item_mark: b.item_mark || undefined,
          spl_remarks: b.spl_remarks || undefined,
          vakkal: b.vakkal || undefined,
          net_weight: b.net_weight || undefined,
          gross_weight: b.gross_weight || undefined,
          count: b.count ? parseInt(b.count) : undefined,
        })),
      })
```

- [ ] **Step 7: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 8: Manual smoke** — approve a cold CR (status Approved → `boxesUnlocked`), confirm: cold fields show + cascade to boxes; LotRangeDedicator now appears (warehouse canonical); "Apply to all" fills net/gross/count; final submit persists lot + cold fields (verify via `GET /rtv/CFPL/{id}` boxes).

- [ ] **Step 9: Commit**

```bash
git add app/[company]/reordering/[id]/approve/page.tsx
git commit -m "feat(rtv): cold fields, cascade, lot-range + bulk box entry on approve page"
```

---

### Task 13: Frontend — print-all + per-article range printing on the APPROVE page

Mirror the inward bulk-sticker batch printer. The CR per-box label routine lives at `approve/page.tsx` (~lines 460-545); reuse its label HTML/CSS.

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\reordering\[id]\approve\page.tsx`
- Reference (batch printer): `app/[company]/inward/bulk-sticker/page.tsx:458-572`

- [ ] **Step 1: Add `lot` + `item mark` to the existing per-box label** — in the label HTML built in `handlePrintBox` (the `.lot` line, ~`approve/page.tsx:520`), replace the customer-only footer:

```tsx
              <div class="lot">${[box.lot_number, box.item_mark].filter(Boolean).join(" · ") || customer || ""}</div>
```

- [ ] **Step 2: Add a `printLabels(boxesToPrint)` batch helper** — factor the QR-loop + iframe write out of `handlePrintBox`. Insert near the print code:

```tsx
  const printLabels = async (boxesToPrint: BoxForm[]) => {
    if (boxesToPrint.length === 0) {
      toast({ title: "Nothing to print", description: "No boxes match.", variant: "destructive" })
      return
    }
    const rtvStringId = data?.rtv_id || ""
    const qrCodes = await Promise.all(
      boxesToPrint.map((b) => QRCode.toDataURL(JSON.stringify({ rtv: rtvStringId, bi: b.box_id || `${b.box_number}` }), { width: 170, margin: 1, errorCorrectionLevel: "M" })),
    )
    const labels = boxesToPrint.map((b, i) => `
      <div class="label">
        <div class="qr"><img src="${qrCodes[i]}" /></div>
        <div class="info">
          <div><div class="company">${company}</div><div class="txn">${rtvStringId}</div><div class="boxid">ID: ${b.box_id || "—"}</div></div>
          <div class="item">${b.article_description}</div>
          <div>
            <div class="detail"><b>Box #${b.box_number}</b> &nbsp; Net: ${b.net_weight || "—"}kg &nbsp; Gross: ${b.gross_weight || "—"}kg</div>
            ${b.count ? `<div class="detail">Count: ${b.count}</div>` : ""}
          </div>
          <div class="lot">${[b.lot_number, b.item_mark].filter(Boolean).join(" · ") || customer || ""}</div>
        </div>
      </div>`).join("")

    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0"
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(`<!DOCTYPE html><html><head><title>Labels</title><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      @page { size: 4in 2in; margin: 0; }
      .label { width:4in; height:2in; background:#fff; border:1px solid #000; display:flex; font-family:Arial, sans-serif; page-break-after:always; }
      .qr { width:2in; height:2in; display:flex; align-items:center; justify-content:center; padding:0.1in; }
      .qr img { width:1.7in; height:1.7in; }
      .info { width:2in; height:2in; padding:0.08in; font-size:8pt; line-height:1.2; display:flex; flex-direction:column; justify-content:space-between; }
      .company { font-weight:bold; font-size:9pt; } .txn { font-family:monospace; font-size:7pt; }
      .boxid { font-family:monospace; font-size:6.5pt; color:#555; }
      .item { font-weight:bold; font-size:7.5pt; } .detail { font-size:7pt; }
      .lot { font-family:monospace; border-top:1px solid #ccc; padding-top:2px; font-size:6.5pt; }
    </style></head><body>${labels}
      <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.parent.postMessage('print-complete','*')}},300)}</script>
    </body></html>`)
    doc.close()
    const cleanup = (e: MessageEvent) => { if (e.data === "print-complete") { window.removeEventListener("message", cleanup); if (document.body.contains(iframe)) document.body.removeChild(iframe) } }
    window.addEventListener("message", cleanup)
    setTimeout(() => { if (document.body.contains(iframe)) { document.body.removeChild(iframe); window.removeEventListener("message", cleanup) } }, 30000)
  }
```

- [ ] **Step 3: Add a "Print all labels" button** in the page action header, enabled only when `boxesUnlocked && boxForms.some(b => b.box_id)`:

```tsx
            <Button variant="outline" size="sm" disabled={!boxesUnlocked}
              onClick={() => printLabels(boxForms.filter((b) => b.box_id))}>
              <Printer className="h-4 w-4" /> Print all labels
            </Button>
```

- [ ] **Step 4: Add per-article range print** — below the bulk-fill row (Task 12 Step 5), add From/To inputs + button using per-article state `const [printRange, setPrintRange] = useState<Record<string, { from: string; to: string }>>({})`:

```tsx
                  {boxesUnlocked && (
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Print range:</span>
                      <Input type="number" min="1" placeholder="From" className="h-7 w-20 text-xs"
                        value={printRange[line.item_description]?.from || ""}
                        onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), from: e.target.value } }))} />
                      <Input type="number" min="1" placeholder="To" className="h-7 w-20 text-xs"
                        value={printRange[line.item_description]?.to || ""}
                        onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), to: e.target.value } }))} />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const r = printRange[line.item_description]
                          const from = parseInt(r?.from || "1"), to = parseInt(r?.to || "999999")
                          printLabels(boxForms.filter((b) => b.article_description === line.item_description && b.box_id && b.box_number >= from && b.box_number <= to))
                        }}>
                        Print range
                      </Button>
                    </div>
                  )}
```

- [ ] **Step 5: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual smoke** — after entering boxes in bulk and submitting (box_ids assigned), "Print all labels" opens a multi-label print; "Print range" prints only the selected box range; labels show lot + item mark.

- [ ] **Step 7: Commit**

```bash
git add app/[company]/reordering/[id]/approve/page.tsx
git commit -m "feat(rtv): print-all + per-article range QR printing on approve page"
```

---

### Task 14: Frontend — post-approval edit (cold fields, update lot later, range print, reprint) on the `[id]` detail page

The detail page (`reordering/[id]/page.tsx`) is currently read-only reprint. Make it the "edit later" surface: edit cold article fields, update lots via the dedicator, range-print, reprint — for an already-approved CR. *(Adjustable: if a dedicated `[id]/edit` route is preferred later, lift this section there.)*

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\reordering\[id]\page.tsx`
- Reuses: `WarehouseSelect`, `LotRangeDedicator`, `BoxScrollContainer`, `lib/utils/rtvCold.ts`, `printLabels`

- [ ] **Step 1: Add an "Edit" toggle** (`const [editing, setEditing] = useState(false)`) gated on `data?.status === "Approved"`, with a header button `Edit details`.

- [ ] **Step 2: Load lines + boxes into editable form state** mirroring the approve page (`lineForms`, `boxForms` of type `ColdBox`), populated from `data.lines` / `data.boxes` including `lot_number/item_mark/spl_remarks/vakkal`.

- [ ] **Step 3: When `editing`, render** the cold article fields (gated on `isColdWarehouse(factory_unit)`), the `LotRangeDedicator` (`onApply` → `applyLotRangesHelper`), the per-article range-print control, and reuse `printLabels` from Task 13 (extract it into `lib/utils/rtvPrint.ts` so both pages import it — move the Task 13 Step 2 function there and import in both pages).

- [ ] **Step 4: Persist edits** — call `rtvApi.updateRTVLines(company, id, { lines })` for article fields and `rtvApi.bulkSaveBoxes(company, id, { boxes })` for lots/cold box fields, then `logBoxEdit` for changed lots (reuse the existing edit-log pattern from `new/page.tsx:434-450`).

- [ ] **Step 5: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual smoke** — open an approved cold CR, toggle Edit, change a lot via the dedicator on boxes 10–20, save, reload → lots persisted; reprint reflects the new lot.

- [ ] **Step 7: Commit**

```bash
git add app/[company]/reordering/[id]/page.tsx lib/utils/rtvPrint.ts app/[company]/reordering/[id]/approve/page.tsx
git commit -m "feat(rtv): post-approval edit (cold fields, lot update, range print, reprint) on detail page"
```

---

### Task 15: Frontend — canonical warehouse display on the list page

**Files:**
- Modify: `c:\Backup\frontend\app\[company]\reordering\page.tsx`

- [ ] **Step 1: Display via the canonical helper** — wherever `record.factory_unit` is rendered, wrap it:

```tsx
import { getDisplayWarehouseName } from "@/lib/constants/warehouses"
// ...
{getDisplayWarehouseName(record.factory_unit)}
```
If a factory-unit filter `<Select>` exists on the list page, replace its options with the shared `WarehouseSelect` (value = canonical code) so filtering matches stored canonical values.

- [ ] **Step 2: Verify build + lint**

Run: `cd c:\Backup\frontend && npm run lint && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke** — list shows `Savla D-39` / `Supreme Cold` etc.; a legacy `New Savla` row displays as `Savla D-514`.

- [ ] **Step 4: Commit**

```bash
git add app/[company]/reordering/page.tsx
git commit -m "feat(rtv): canonical warehouse display on reordering list"
```

---

### Task 16: Full-feature verification pass

**Files:** none (verification only)

- [ ] **Step 1: Backend suite**

Run: `cd c:\Backup\backend && python test_rtv_cold_fields.py && python test_rtv_bulk_boxes.py && python test_rtv_canonical_warehouse.py`
Expected: three `ALL PASS`.

- [ ] **Step 2: Frontend unit suite + build**

Run: `cd c:\Backup\frontend && npm run test && npm run build`
Expected: vitest green (WarehouseSelect + rtvCold), build succeeds.

- [ ] **Step 3: End-to-end smoke (manual)** — create a cold CR (Savla D-39) with cold article fields → send for approval → mark approved → bulk-enter boxes → assign lots by range → print all → reload and confirm lots/cold fields persisted on `GET /rtv/CFPL/{id}`. Then edit the CR later and change a lot; confirm reprint reflects it.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git commit -am "test(rtv): verification fixups for cold fields + canonical warehouses"
```

---

## Phase 2 (scoped follow-up — NOT built in this plan)

**Active write of RTV cold boxes into `cfpl/cdpl_cold_stocks`** so cold transfer fetches RTV lots cross-DB. Phase 1 already captures every field Phase 2 needs (`canonical factory_unit`, `lot_number`, `item_mark`, `vakkal`, per box). Outline for the future plan:

- On `bulk_save_boxes`/`approve_rtv`, when `_canonical_factory_unit(factory_unit)` is a cold warehouse, insert one `cold_stocks` row per box with `box_id`, `transaction_no` (the RTV id), `lot_no`, `item_description`, `unit`/`storage_location`, `vakkal`, `item_mark`, and `canonical_warehouse`/`canonical_group`/`canonical_subgroup` pre-filled — mirroring `inward_tools.py:2180-2220` and `:3080-3115`. The `sync_canonical_cold_stock()` trigger then maintains the canonical columns.
- Reference: `backend/services/cold_storage_service/migrations/20260525_canonical_cold_stock_columns.sql` and `shared/canonicalize.py`.

---

## Self-Review

**1. Spec coverage**
- Issue #1 (canonical warehouses): Tasks 7 (backend canonicalize), 9 (FE WarehouseSelect on new+approve), 15 (list display). ✅
- Issue #2 cold fields (lot/item_mark/spl_remarks/vakkal): Tasks 1-6 (backend), 8, 11 (new), 12 (approve), 14 (edit). ✅
- Assign lot to box range: `LotRangeDedicator` wired via Task 12 Step 4 (+ Task 10 helper). ✅
- Go to box/lot: existing `BoxScrollContainer`, now functional once warehouse is canonical (Task 9). ✅
- Bulk QR + bulk box entry + per-article range print + lot updatable later: Tasks 12 (bulk entry), 13 (print-all + range), 14 (update lot later). ✅
- Field placement New + Approve + Edit: Tasks 11, 12, 14. ✅
- Legacy display-mapping only: Tasks 9 (WarehouseSelect preserves legacy value), 15 (`getDisplayWarehouseName`); no migration of existing rows. ✅
- Cross-link readiness (phased): Tasks 1-7 capture/store the fields canonically; Phase 2 documented. ✅

**2. Placeholder scan** — every code step contains concrete code; no TBD/TODO. Manual-smoke steps are explicit (selectors, expected behaviour), not "test the above".

**3. Type/name consistency** — field key `spl_remarks` (not `special_remarks`) used uniformly across SQL, Pydantic, TS, payloads, and labels. `ColdBox` shape in `rtvCold.ts` matches the approve-page `BoxForm` (Task 12 Step 1). `bulk_save_boxes` tool name matches the `bulkSaveBoxes` FE call and the new endpoint. `_canonical_factory_unit` used identically in create + approve. `printLabels` is extracted to `lib/utils/rtvPrint.ts` in Task 14 so both pages share one definition (no divergent copies).

**Known caveat to verify during execution:** `RTVLineForm` (in `components/modules/rtv/RTVLineEditor.tsx`) and the approve-page line-form type must each gain the four cold fields (Tasks 11 Step 1, 12 Step 2); if either is a strict interface, add the optional fields there or `tsc` will error.
