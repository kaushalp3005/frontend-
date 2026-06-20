# Cold-Transfer Vakkal — Design Spec

**Date:** 2026-06-18
**Author:** ai.1@candorfoods.in (with Claude Code)
**Status:** Draft — pending user review

## Problem

When goods are transferred **out** of a regular Candor warehouse (W202, A85, F53, A68)
**into** an external cold warehouse (Savla D-39, Savla D-514, Rishi, Supreme), the cold
warehouse identifies each article by its **vakkal** (lot/bag mark). Today:

- The transfer-out has **no place to record the vakkal per article**. The line table
  (`interunit_transfers_lines`) has no `vakkal` column.
- The **gate pass** and **delivery challan** (one shared component) do not print vakkal,
  so the cold warehouse receives goods with no mark on the paperwork.
- The cold transfer-**in** (receipt) screen already has a per-article **Vakkal** input,
  but it starts **blank** and must be re-typed by hand on every receipt
  (`coldtransfer-in/page.tsx:474`).

The vakkal is known at dispatch but is lost in transit and re-keyed at receipt.

## Goal

Capture vakkal **per article** at transfer-out to a cold warehouse, persist it, print it
on the gate pass and delivery challan, and **auto-fill** it on the cold transfer-in
(receipt) from the matching transfer-out — while still letting the receiving operator
edit it.

## Decisions (confirmed with user)

1. **Mandatory at transfer-out** when the destination is a cold warehouse — block dispatch
   if any cold-bound article has an empty vakkal.
2. **Editable, pre-filled** at transfer-in — auto-fill from the transfer-out, but the
   receiving operator can override.
3. **Always show** the Vakkal column on the gate pass and delivery challan (blank for
   transfers that have no vakkal, e.g. historical or non-cold).
4. Add the field to **both** transfer-out creation paths: `directtransferform` (direct
   create/edit) and `transferform` (fulfilling an approved request).

## Approach

Add a real **`vakkal` column on `interunit_transfers_lines`**, mirroring exactly how
`lot_number` already behaves: written on create/edit, returned by the transfer-detail
GET, and therefore available to the documents and to the cold transfer-in's existing
per-article model.

**Rejected alternatives:**

- *JSONB blob on the header* — vakkal is per-article, not per-transfer; not queryable;
  breaks the clean `lines[]` shape that the cold transfer-in already consumes.
- *Reuse `pending_transfer_stock.cold_storage_data`* — that snapshot path is for
  cold-**source** transfers; our source is a regular warehouse, so that ledger is not
  populated the same way here. A line column is simpler and ledger-independent.

## Design

### 1. Backend — persist & return vakkal per line

- **Migration:** add nullable `vakkal VARCHAR(100)` to `interunit_transfers_lines` via the
  app's startup `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern.
- **Schemas** (`services/ims_service/interunit_models.py`):
  - `TransferLineCreate` (line ~171): add `vakkal: Optional[str] = None`.
  - `TransferLineResponse` (line ~257): add `vakkal: Optional[str] = None`.
- **Persistence & read** (`services/ims_service/interunit_tools.py`):
  - Add `vakkal` to the line INSERT in **create** (line ~854) and **edit** (line ~1485):
    column list, `VALUES` placeholders, and the params dict (`"vakkal": line.vakkal or ""`).
  - Add `vakkal` to the line SELECT in the transfer-detail read (line ~573) so the GET
    response carries `lines[].vakkal`.

### 2. Transfer-out forms — capture vakkal, mandatory for cold destinations

Applies to **`directtransferform/page.tsx`** and **`transferform/page.tsx`**.

- Add `vakkal: string` to the per-article state shape (next to `lot_number`).
- Render a per-article **Vakkal** text input beside the existing **Lot No** field
  (directtransferform ~line 2742). Free text, consistent with the vakkal inputs already
  used in inward / cold transfer-in / job-work.
- **Conditional requirement:** using `isColdWarehouse(formData.toWarehouse)` from
  `lib/constants/warehouses.ts`:
  - destination cold → vakkal **required** for every article; on submit, if any is empty,
    block with a clear toast naming the offending article(s).
  - destination non-cold → field still visible, optional.
- Include `vakkal` in each line of the create/edit payload.
- On **edit load**, populate `vakkal` from `line.vakkal` (directtransferform edit path
  ~lines 701–822).

### 3. Documents — always show a Vakkal column

In `components/transfer/DeliveryChallan.tsx`:

- Add a **Vakkal** column to the **delivery-challan** table (header row ~201–213, body row
  ~265–301, totals/colspans) and to the **gate-pass** table (header ~456–463, body
  ~464–493, colgroup ~394–401, summary colspans).
- Consolidation already does `{ ...item }`, so a `vakkal` field survives grouping (first
  line per group wins — consistent with one-vakkal-per-article).
- Bump the column-count math: `DC_COLS`, `colgroup`, and every `colSpan` that assumes the
  current 8/9-column (DC) and 5/6-column (gate pass) layouts.
- **Suggested placement/label:** column header `Vakkal`, positioned immediately after
  `Item Description` on both tables.

The `items` passed to `DeliveryChallan` must carry `vakkal`. Two feed points:

- The forms at print time (`directtransferform` / `transferform`) — include `vakkal` on
  each item.
- The standalone DC route `transfer/dc/[transferId]/page.tsx` — map `line.vakkal` into the
  `items` it builds from the fetched transfer detail (vakkal now arrives via the GET).

### 4. Cold transfer-in — auto-pick instead of blank

In `app/[company]/cold-transfer/coldtransfer-in/page.tsx`:

- At the cold-item map init (line ~474), set `vakkal: line.vakkal || ""` instead of `""`.
  The article list is already built from the transfer-out `lines`, so the matching
  vakkal is in hand.
- The field stays **editable** (line ~2385) — operator can override.

## Data flow (end to end)

```
Transfer-out form (W202 → Savla D-39)
  per-article Vakkal input (required for cold dest)
        │  POST /interunit/transfers  (lines[].vakkal)
        ▼
interunit_transfers_lines.vakkal   ← new column
        │  GET /interunit/transfers/{id}  (lines[].vakkal)
        ├───────────────► Delivery Challan + Gate Pass  (Vakkal column)
        │                 (form print  &  /transfer/dc/[id])
        └───────────────► Cold Transfer-In receipt
                          auto-fills per-article Vakkal (editable)
```

## Edge cases & non-goals

- **Same article on two lines with different vakkals:** the cold transfer-in groups by
  article name and takes the first line's vakkal; the operator edits the remainder.
  Accepted — matches the one-vakkal-per-article intent.
- **Historical transfers:** `vakkal` is `NULL`; the documents print a blank cell. No
  backfill.
- **Cold-source transfers (cold → cold inner transfers):** already carry vakkal from
  `cold_stocks`; **out of scope**, untouched.
- **Non-cold transfers:** vakkal optional; column prints blank.

## Testing

- **Backend:** create a transfer-out with `vakkal` on lines → assert it persists and the
  detail GET returns `lines[].vakkal`; edit a transfer changing vakkal → assert update.
- **Transfer-out form:** cold destination with a blank vakkal → submit blocked with toast;
  all vakkals filled → submits; reopen in edit → vakkal repopulated.
- **Documents:** delivery challan and gate pass render the Vakkal column with values and
  correct column alignment (with and without the PM/Count column present).
- **Cold transfer-in:** load a transfer-out that has vakkals → receipt screen pre-fills the
  per-article Vakkal; operator edit still works.
```
