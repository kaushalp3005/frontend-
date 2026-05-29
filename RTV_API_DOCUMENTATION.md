# RTV (Return to Vendor) API Documentation

## Overview
Complete RTV backend system with separate tables for CDPL and CFPL companies. All endpoints support company-specific data isolation.

## Database Tables

### CFPL Tables
- `cfplrtv_master` - CFPL RTV header information
- `cfplrtv_items` - CFPL RTV items/boxes

### CDPL Tables
- `cdplrtv_master` - CDPL RTV header information
- `cdplrtv_items` - CDPL RTV items/boxes

## API Endpoints

### 1. Create RTV
**Endpoint:** `POST /rtv/create`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Request Payload:**
```json
{
  "customer_code": "CDPL-RR-001",
  "customer_name": "Reliance Retail Limited",
  "rtv_type": "quality_issue",
  "other_reason": null,
  "rtv_date": "2025-01-28",
  "invoice_number": "INV-2024-001",
  "dc_number": "DC-2024-001",
  "notes": "Urgent return - Quality issues found",
  "created_by": "john.doe@candorfoods.com",
  "items": [
    {
      "transaction_no": "CONS-202410241230",
      "box_number": 1,
      "sub_category": "Nuts & Seeds",
      "item_description": "ALMOND BLANCHED SLICED",
      "net_weight": 20.5,
      "gross_weight": 21.0,
      "price": 3000.00,
      "reason": "",
      "qr_data": {
        "co": "CFPL",
        "cn": "CONS-202410241230",
        "bx": 1,
        "sc": "Nuts & Seeds",
        "id": "ALMOND BLANCHED SLICED",
        "nw": 20.5,
        "gw": 21.0
      }
    },
    {
      "transaction_no": "TR-202510161131",
      "box_number": 1,
      "sub_category": "",
      "item_description": "CASHEW ROASTED",
      "net_weight": 25.0,
      "gross_weight": 26.0,
      "price": 4000.00,
      "reason": "",
      "qr_data": {
        "co": "CFPL",
        "tx": "TR-202510161131",
        "bx": 1,
        "it": "CASHEW ROASTED",
        "nw": 25,
        "tw": 26
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "rtv_number": "RTV202501281530",
  "message": "RTV created successfully"
}
```

**Features:**
- Auto-generates RTV number in format `RTVYYYYMMDDHHMM`
- Validates that no `transaction_no` already exists in any RTV (CFPL or CDPL)
- Calculates `total_value` and `total_boxes` from items
- Stores in company-specific table

---

### 2. Get RTV List
**Endpoint:** `GET /rtv/list`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`, `completed`)
- `date_from` (optional): Filter from date (`YYYY-MM-DD`)
- `date_to` (optional): Filter to date (`YYYY-MM-DD`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Example Request:**
```
GET /rtv/list?company=CDPL&status=pending&date_from=2025-01-01&date_to=2025-01-31&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rtv_number": "RTV202501281530",
      "customer_code": "CDPL-RR-001",
      "customer_name": "Reliance Retail Limited",
      "rtv_type": "quality_issue",
      "rtv_date": "2025-01-28",
      "invoice_number": "INV-2024-001",
      "dc_number": "DC-2024-001",
      "total_value": 9000.00,
      "total_boxes": 3,
      "status": "pending",
      "company_code": "CDPL",
      "created_at": "2025-01-28T15:30:00Z",
      "updated_at": "2025-01-28T15:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### 3. Get RTV Details
**Endpoint:** `GET /rtv/{rtv_number}`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Path Parameters:**
- `rtv_number` (required): RTV number

**Example Request:**
```
GET /rtv/RTV202501281530?company=CDPL
```

**Response:**
```json
{
  "rtv_number": "RTV202501281530",
  "customer_code": "CDPL-RR-001",
  "customer_name": "Reliance Retail Limited",
  "rtv_type": "quality_issue",
  "other_reason": null,
  "rtv_date": "2025-01-28",
  "invoice_number": "INV-2024-001",
  "dc_number": "DC-2024-001",
  "notes": "Urgent return - Quality issues found",
  "created_by": "john.doe@candorfoods.com",
  "total_value": 9000.00,
  "total_boxes": 3,
  "status": "pending",
  "company_code": "CDPL",
  "created_at": "2025-01-28T15:30:00Z",
  "updated_at": "2025-01-28T15:30:00Z",
  "items": [
    {
      "item_id": 1,
      "rtv_number": "RTV202501281530",
      "transaction_no": "CONS-202410241230",
      "box_number": 1,
      "sub_category": "Nuts & Seeds",
      "item_description": "ALMOND BLANCHED SLICED",
      "net_weight": 20.5,
      "gross_weight": 21.0,
      "price": 3000.00,
      "reason": "",
      "qr_data": {
        "co": "CFPL",
        "cn": "CONS-202410241230",
        "bx": 1,
        "sc": "Nuts & Seeds",
        "id": "ALMOND BLANCHED SLICED",
        "nw": 20.5,
        "gw": 21.0
      }
    }
  ]
}
```

---

### 4. Update RTV Status
**Endpoint:** `PUT /rtv/{rtv_number}/status`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Path Parameters:**
- `rtv_number` (required): RTV number

**Request Payload:**
```json
{
  "status": "approved",
  "remarks": "Approved by manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "RTV status updated to approved",
  "rtv_number": "RTV202501281530"
}
```

**Valid Status Values:**
- `pending`
- `approved`
- `rejected`
- `completed`

---

### 5. Validate Box
**Endpoint:** `POST /rtv/validate-box`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Request Payload:**
```json
{
  "transaction_no": "CONS-202410241230"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "message": "Box CONS-202410241230 can be added to RTV"
}
```

**Response (Already Exists):**
```json
{
  "valid": false,
  "message": "Transaction CONS-202410241230 already exists in RTV RTV202501281530",
  "existing_rtv": "RTV202501281530"
}
```

**Features:**
- Checks if `transaction_no` already exists in any RTV (CFPL or CDPL)
- Prevents duplicate scans across all RTVs

---

### 6. Get Customers List
**Endpoint:** `GET /rtv/customers`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Example Request:**
```
GET /rtv/customers?company=CDPL
```

**Response (CDPL):**
```json
{
  "success": true,
  "data": [
    {"value": "CDPL-RR-001", "label": "Reliance Retail Limited"},
    {"value": "CDPL-RF-001", "label": "Reliance Fresh"},
    {"value": "CDPL-BI-001", "label": "Big Bazaar"},
    {"value": "CDPL-DM-001", "label": "DMart"},
    {"value": "CDPL-MT-001", "label": "Metro Cash & Carry"},
    {"value": "CDPL-SP-001", "label": "Spencer's Retail"},
    {"value": "CDPL-FV-001", "label": "Food Bazaar"},
    {"value": "OTHER", "label": "Other (Custom)"}
  ]
}
```

**Response (CFPL):**
```json
{
  "success": true,
  "data": [
    {"value": "CFPL-RF-001", "label": "Reliance Fresh"},
    {"value": "CFPL-RR-001", "label": "Reliance Retail Limited"},
    {"value": "CFPL-BI-001", "label": "Big Bazaar"},
    {"value": "CFPL-DM-001", "label": "DMart"},
    {"value": "CFPL-MT-001", "label": "Metro Cash & Carry"},
    {"value": "CFPL-SP-001", "label": "Spencer's Retail"},
    {"value": "CFPL-FV-001", "label": "Food Bazaar"},
    {"value": "OTHER", "label": "Other (Custom)"}
  ]
}
```

---

### 7. Delete RTV
**Endpoint:** `DELETE /rtv/{rtv_number}`

**Query Parameters:**
- `company` (required): `CFPL` or `CDPL`

**Path Parameters:**
- `rtv_number` (required): RTV number to delete

**Example Request:**
```
DELETE /rtv/RTV202412011200?company=CFPL
```

**Response:**
```json
{
  "success": true,
  "message": "RTV RTV202412011200 and all associated items deleted successfully",
  "rtv_number": "RTV202412011200"
}
```

**Features:**
- Deletes RTV master record
- Automatically deletes all associated items (cascade delete)
- Works for both CFPL and CDPL companies
- Returns the deleted RTV number for confirmation

**Error Response (404):**
```json
{
  "success": false,
  "message": "RTV not found"
}
```

---

## RTV Types

Valid `rtv_type` values:
- `quality_issue` - Quality issue
- `damaged` - Damaged goods
- `expired` - Expired items
- `excess_quantity` - Excess quantity
- `wrong_item` - Wrong item received
- `other` - Other reason (requires `other_reason` field)

---

## RTV Status Values

Valid `status` values:
- `pending` - Default status when RTV is created
- `approved` - RTV has been approved
- `rejected` - RTV has been rejected
- `completed` - RTV has been completed

---

## QR Code Format Support

The system supports two QR code formats:

### 1. CONS Format (Consumption)
```json
{
  "co": "cdpl",
  "cn": "CONS-202501281230",
  "bx": 1,
  "sc": "Nuts & Seeds",
  "id": "ALMOND BLANCHED SLICED",
  "nw": 20.5,
  "gw": 21.0
}
```

### 2. Transfer Format (Inter-unit Transfer)
```json
{
  "co": "cfpl",
  "tx": "TR-202501281131",
  "bx": 1,
  "it": "CASHEW ROASTED",
  "nw": 25,
  "tw": 26
}
```

---

## Database Migration

Run the migration SQL file to create tables:
```bash
psql -U your_user -d your_database -f app/database_migrations/rtv_migration.sql
```

Or manually execute the SQL from `app/database_migrations/rtv_migration.sql`

---

## Error Handling

### 400 Bad Request
- Invalid company code
- Invalid RTV type
- Invalid status
- Transaction already exists in another RTV

### 404 Not Found
- RTV number not found

### 500 Internal Server Error
- Database connection issues
- Unexpected errors

---

## Notes

1. **Company Separation**: All data is stored in separate tables for CFPL and CDPL
2. **Transaction Validation**: The system checks both CFPL and CDPL tables to prevent duplicate transaction_no across all RTVs
3. **Auto RTV Number**: RTV numbers are auto-generated in format `RTVYYYYMMDDHHMM`
4. **Cascade Delete**: When an RTV is deleted, all associated items are automatically deleted
5. **QR Data Storage**: Complete QR code data is stored as JSON in the `qr_data` field
6. **Total Calculation**: `total_value` and `total_boxes` are automatically calculated from items

