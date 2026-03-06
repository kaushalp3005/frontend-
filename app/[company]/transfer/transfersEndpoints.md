# Transfer Module API Endpoints with Payloads

## Base URL: /transfer

---

## 1. Warehouse Management Endpoints

### GET /transfer/warehouses
*Description:* Get all warehouses for dropdowns

*Query Parameters:*
json
{
  "is_active": true  // optional, defaults to true
}


*Response:*
json
{
  "success": true,
  "message": "Warehouses retrieved successfully",
  "data": [
    {
      "id": 1,
      "warehouse_code": "W202",
      "warehouse_name": "W202 Warehouse",
      "address": "MIDC, TTC Industrial Area, Khairne, Navi Mumbai - 400710",
      "city": "Navi Mumbai",
      "state": "Maharashtra",
      "pincode": "400710",
      "gstin": "27ABCDE1234F1Z5",
      "contact_person": "Warehouse Manager",
      "contact_phone": "+919876543210",
      "contact_email": "manager@warehouse.com",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}


---

## 2. Transfer Request Endpoints

### POST /transfer/request
*Description:* Create a new transfer request

*Request Body:*
json
{
  "request_date": "2025-10-18",
  "from_warehouse": "W202",
  "to_warehouse": "A185",
  "reason": "Urgent restock",
  "reason_description": "Urgent restock needed for production",
  "created_by": "user001",
  "items": [
    {
      "line_number": 1,
      "material_type": "RM",
      "item_category": "raw_materials",
      "sub_category": "flour",
      "item_description": "Wheat Flour 1kg",
      "sku_id": "SKU001234",
      "quantity": 100.000,
      "uom": "PCS",
      "pack_size": 1.00,
      "package_size": "1kg",
      "net_weight": 1.000
    },
    {
      "line_number": 2,
      "material_type": "PM",
      "item_category": "packaging",
      "sub_category": "bags",
      "item_description": "Plastic Bags 500g",
      "sku_id": "SKU001235",
      "quantity": 50.000,
      "uom": "PCS",
      "pack_size": 0.50,
      "package_size": "500g",
      "net_weight": 0.500
    }
  ]
}


*Response:*
json
{
  "success": true,
  "message": "Transfer request created successfully",
  "data": {
    "request_no": "REQ20251018001",
    "request_id": 1
  }
}


### GET /transfer/requests
*Description:* Get transfer requests list with filtering and pagination

*Query Parameters:*
json
{
  "status": "Pending",           // optional: Pending|Approved|Rejected|In Transit|Completed
  "from_warehouse": "W202",      // optional
  "to_warehouse": "A185",        // optional
  "request_date_from": "2025-10-01",  // optional
  "request_date_to": "2025-10-31",    // optional
  "created_by": "user001",       // optional
  "page": 1,                     // optional, defaults to 1
  "per_page": 20                 // optional, defaults to 20, max 100
}


*Response:*
json
{
  "success": true,
  "message": "Transfer requests retrieved successfully",
  "data": [
    {
      "id": 1,
      "request_no": "REQ20251018001",
      "transfer_no": null,
      "request_date": "2025-10-18",
      "from_warehouse": "W202",
      "to_warehouse": "A185",
      "reason_description": "Urgent restock needed for production",
      "status": "Pending",
      "item_count": 2,
      "created_by": "user001",
      "created_at": "2025-10-18T10:00:00Z"
    },
    {
      "id": 2,
      "request_no": "REQ20251018002",
      "transfer_no": "TRANS20251018001",
      "request_date": "2025-10-18",
      "from_warehouse": "W301",
      "to_warehouse": "W202",
      "reason_description": "Stock rebalancing",
      "status": "In Transit",
      "item_count": 1,
      "created_by": "user002",
      "created_at": "2025-10-18T11:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "per_page": 20,
  "pages": 2
}


### GET /transfer/requests/{request_id}
*Description:* Get transfer request details by ID (used in transfer form)

*Path Parameters:*
json
{
  "request_id": 1
}


*Response:*
json
{
  "success": true,
  "message": "Transfer request details retrieved successfully",
  "data": {
    "id": 1,
    "request_no": "REQ20251018001",
    "transfer_no": null,
    "request_date": "2025-10-18",
    "from_warehouse": "W202",
    "to_warehouse": "A185",
    "reason": "Urgent restock",
    "reason_description": "Urgent restock needed for production",
    "status": "Pending",
    "created_by": "user001",
    "created_at": "2025-10-18T10:00:00Z",
    "updated_at": "2025-10-18T10:00:00Z",
    "items": [
      {
        "id": 1,
        "line_number": 1,
        "material_type": "RM",
        "item_category": "raw_materials",
        "sub_category": "flour",
        "item_description": "Wheat Flour 1kg",
        "sku_id": "SKU001234",
        "quantity": 100.000,
        "uom": "PCS",
        "pack_size": 1.00,
        "package_size": "1kg",
        "net_weight": 1.000,
        "created_at": "2025-10-18T10:00:00Z"
      },
      {
        "id": 2,
        "line_number": 2,
        "material_type": "PM",
        "item_category": "packaging",
        "sub_category": "bags",
        "item_description": "Plastic Bags 500g",
        "sku_id": "SKU001235",
        "quantity": 50.000,
        "uom": "PCS",
        "pack_size": 0.50,
        "package_size": "500g",
        "net_weight": 0.500,
        "created_at": "2025-10-18T10:00:00Z"
      }
    ],
    "scanned_boxes": [],
    "transport_info": null
  }
}


---

## 3. Transfer Form Endpoints

### POST /transfer/submit
*Description:* Submit complete transfer with scanned boxes and transport details

*Request Body:*
json
{
  "request_no": "REQ20251018001",
  "request_date": "2025-10-18",
  "from_warehouse": "W202",
  "to_warehouse": "A185",
  "reason_description": "Urgent restock needed for production",
  "items": [
    {
      "line_number": 1,
      "material_type": "RM",
      "item_category": "raw_materials",
      "sub_category": "flour",
      "item_description": "Wheat Flour 1kg",
      "sku_id": "SKU001234",
      "quantity": 100.000,
      "uom": "PCS",
      "pack_size": 1.00,
      "package_size": "1kg",
      "net_weight": 1.000
    }
  ],
  "scanned_boxes": [
    {
      "box_id": 1,
      "transaction_no": "TX20251018001",
      "sku_id": "SKU001234",
      "box_number_in_array": 1,
      "box_number": 1,
      "item_description": "Wheat Flour 1kg",
      "net_weight": 25.500,
      "gross_weight": 26.000,
      "qr_data": {
        "transaction_no": "TX20251018001",
        "sku_id": "SKU001234",
        "batch_no": "BATCH001",
        "lot_no": "LOT001",
        "expiry_date": "2024-02-15"
      }
    },
    {
      "box_id": 2,
      "transaction_no": "TX20251018001",
      "sku_id": "SKU001234",
      "box_number_in_array": 2,
      "box_number": 2,
      "item_description": "Wheat Flour 1kg",
      "net_weight": 25.500,
      "gross_weight": 26.000,
      "qr_data": {
        "transaction_no": "TX20251018001",
        "sku_id": "SKU001234",
        "batch_no": "BATCH001",
        "lot_no": "LOT001",
        "expiry_date": "2024-02-15"
      }
    }
  ],
  "transport_info": {
    "vehicle_number": "MH43BP6885",
    "vehicle_number_other": null,
    "driver_name": "Tukaram",
    "driver_name_other": null,
    "driver_phone": "+919930056340",
    "approval_authority": "John Doe"
  }
}


*Response:*
json
{
  "success": true,
  "message": "Transfer submitted successfully",
  "data": {
    "request_no": "REQ20251018001",
    "transfer_no": "TRANS20251018001",
    "status": "In Transit",
    "scanned_boxes_count": 2
  }
}


---

## 4. Scanner Endpoints

### POST /transfer/scanner/resolve
*Description:* Resolve scanned box/lot/batch information

*Request Body:*
json
{
  "scan_value": "TX20251018001",
  "warehouse": "W202"
}


*Response:*
json
{
  "success": true,
  "message": "Scan resolved successfully",
  "data": {
    "scan_value": "TX20251018001",
    "resolved_box": "BOX01",
    "resolved_lot": "LOT01",
    "resolved_batch": "BATCH01",
    "sku_id": "SKU001234",
    "sku_name": "Wheat Flour 1kg",
    "material_type": "RM",
    "uom": "KG",
    "available_qty": 100.000,
    "expiry_date": "2024-02-15",
    "fefo_priority": 1
  }
}


*Error Response:*
json
{
  "success": false,
  "message": "Invalid scan format. Expected transaction number starting with 'TX'",
  "data": null
}


---

## 5. DC Generation Endpoints

### GET /transfer/{company}/{transfer_no}/dc-data
*Description:* Get delivery challan data for DC generation

*Path Parameters:*
json
{
  "company": "CFPL",
  "transfer_no": "TRANS20251018001"
}


*Response:*
json
{
  "success": true,
  "message": "DC data retrieved successfully",
  "data": {
    "transfer_no": "TRANS20251018001",
    "request_no": "REQ20251018001",
    "request_date": "2025-10-18",
    "from_warehouse": {
      "code": "W202",
      "name": "W202 Warehouse",
      "address": "MIDC, TTC Industrial Area, Khairne, Navi Mumbai - 400710",
      "city": "Navi Mumbai",
      "state": "Maharashtra",
      "pincode": "400710",
      "gstin": "27ABCDE1234F1Z5",
      "contact_person": "Warehouse Manager",
      "contact_phone": "+919876543210",
      "contact_email": "manager@warehouse.com"
    },
    "to_warehouse": {
      "code": "A185",
      "name": "A-185 Warehouse",
      "address": "A-185, MIDC TTC Industrial Area, Khairane, Navi Mumbai - 400709",
      "city": "Navi Mumbai",
      "state": "Maharashtra",
      "pincode": "400709",
      "gstin": "27ABCDE1234F1Z6",
      "contact_person": "Warehouse Supervisor",
      "contact_phone": "+919876543211",
      "contact_email": "supervisor@warehouse.com"
    },
    "items": [
      {
        "line_number": 1,
        "material_type": "RM",
        "item_category": "raw_materials",
        "sub_category": "flour",
        "item_description": "Wheat Flour 1kg",
        "sku_id": "SKU001234",
        "quantity": 100.000,
        "uom": "PCS",
        "pack_size": 1.00,
        "package_size": "1kg",
        "net_weight": 1.000
      }
    ],
    "scanned_boxes": [
      {
        "box_id": 1,
        "transaction_no": "TX20251018001",
        "sku_id": "SKU001234",
        "box_number": 1,
        "item_description": "Wheat Flour 1kg",
        "net_weight": 25.500,
        "gross_weight": 26.000
      },
      {
        "box_id": 2,
        "transaction_no": "TX20251018001",
        "sku_id": "SKU001234",
        "box_number": 2,
        "item_description": "Wheat Flour 1kg",
        "net_weight": 25.500,
        "gross_weight": 26.000
      }
    ],
    "transport_info": {
      "vehicle_number": "MH43BP6885",
      "vehicle_number_other": null,
      "driver_name": "Tukaram",
      "driver_name_other": null,
      "driver_phone": "+919930056340",
      "approval_authority": "John Doe"
    }
  }
}


---

## 6. Interunit Compatibility Endpoints

### GET /transfer/interunit/requests/{request_id}
*Description:* Get transfer request for interunit compatibility (used in transfer form)

*Path Parameters:*
json
{
  "request_id": 1
}


*Response:* Same as GET /transfer/requests/{request_id}

### POST /transfer/interunit/{company}
*Description:* Submit transfer for interunit compatibility

*Path Parameters:*
json
{
  "company": "CFPL"
}


*Request Body:* Same as POST /transfer/submit

*Response:* Same as POST /transfer/submit

---

## 7. Utility Endpoints

### GET /transfer/status-options
*Description:* Get available status options for transfer requests

*Response:*
json
{
  "success": true,
  "message": "Status options retrieved successfully",
  "data": [
    {"value": "Pending", "label": "Pending"},
    {"value": "Approved", "label": "Approved"},
    {"value": "Rejected", "label": "Rejected"},
    {"value": "In Transit", "label": "In Transit"},
    {"value": "Completed", "label": "Completed"}
  ]
}


### GET /transfer/material-types
*Description:* Get available material types

*Response:*
json
{
  "success": true,
  "message": "Material types retrieved successfully",
  "data": [
    {"value": "RM", "label": "Raw Material"},
    {"value": "PM", "label": "Packaging Material"},
    {"value": "FG", "label": "Finished Good"},
    {"value": "SFG", "label": "Semi-Finished Good"}
  ]
}


---

## 8. Error Responses

### 400 Bad Request
json
{
  "detail": "Transfer request not found"
}


### 404 Not Found
json
{
  "detail": "Transfer request not found"
}


### 500 Internal Server Error
json
{
  "detail": "Error creating transfer request: [error message]"
}


---

## 9. Complete Flow Example

### Step 1: Create Request
bash
POST /transfer/request

*Payload:* Transfer request creation payload
*Response:* {"request_no": "REQ20251018001", "request_id": 1}

### Step 2: View Requests
bash
GET /transfer/requests?status=Pending&page=1&per_page=20

*Response:* List of pending requests

### Step 3: Get Request Details (for Transfer Form)
bash
GET /transfer/requests/1

*Response:* Complete request details with items

### Step 4: Submit Transfer
bash
POST /transfer/submit

*Payload:* Complete transfer with scanned boxes and transport
*Response:* {"transfer_no": "TRANS20251018001", "status": "In Transit"}

### Step 5: Generate DC
bash
GET /transfer/CFPL/TRANS20251018001/dc-data

*Response:* Complete DC data with warehouse addresses

---

## 10. Key Features

- *Auto-numbering*: REQYYYYMMDDXXX for requests, TRANSYYYYMMDDXXX for transfers
- *Auto-population*: Transfer form auto-fills from request data
- *Duplicate Detection*: Prevents duplicate box scans using unique constraints
- *Real-time Tracking*: Expected vs Scanned vs Pending counts
- *Warehouse Addresses*: Automatic FROM/TO addresses in DC generation
- *Status Workflow*: Pending → In Transit → Completed
- *QR Integration*: Scanner resolution with box/lot/batch information
- *Transport Management*: Vehicle, driver, and approval authority tracking