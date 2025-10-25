# RTV (Return to Vendor) Module - Frontend Documentation

## 📋 Overview
RTV Module is designed for Candor Foods to manage return to vendor processes efficiently. This module allows users to scan boxes via QR codes and create RTV records for returning materials to vendors.

## 🎯 Key Features

### 1. **RTV Dashboard** (`/reordering`)
- **Statistics Cards**: Display real-time metrics
  - Total RTVs
  - Pending RTVs
  - Approved RTVs
  - Completed RTVs
  - Total Value
  
- **Search & Filter**:
  - Search by RTV number, vendor name, or vendor code
  - Filter by status (Pending, Approved, Completed, Rejected)
  
- **RTV Records Table**:
  - Displays all RTV records with complete details
  - Sortable columns
  - Status badges with color coding
  - Quick view actions

### 2. **Create RTV** (`/reordering/create_rtv`)
Complete form to create new RTV with following sections:

#### A. RTV Details Section
- **Vendor Selection**: Searchable dropdown to select vendor
- **RTV Type**: Dropdown with 6 types:
  - Quality Issue - Material not meeting quality standards
  - Damaged - Material damaged during transit/storage
  - Expired - Material expired or near expiry
  - Excess Quantity - Received more than ordered
  - Wrong Item - Incorrect item received
  - Other - Other reasons
- **GRN Reference**: Optional reference to original GRN
- **DC Number**: Delivery challan reference
- **Notes**: Additional notes/comments

#### B. QR Scanner Section
- **High-Performance QR Scanner**:
  - Uses native BarcodeDetector API (Chrome/Edge)
  - Fallback to qr-scanner library for other browsers
  - Real-time camera preview
  - Automatic box detection
  - Duplicate prevention
  
- **Box Data Extraction**:
  - Transaction Number (CONS/TX prefix)
  - SKU ID
  - Material Type (RM/PM/FG)
  - Item Description
  - Batch Number
  - Quantity & UOM
  - Net Weight
  - Manufacturing & Expiry Dates

#### C. Scanned Boxes List
For each scanned box:
- **Display Information**:
  - Box number badge
  - Material type badge
  - Item description
  - Batch number
  - Quantity & weight
  - Transaction reference
  
- **Required Fields** (user fills):
  - **Reason for Return**: Detailed description
  - **Estimated Value**: ₹ amount

- **Actions**:
  - Remove box from list

#### D. Summary Panel (Sticky Right Side)
- RTV Number (auto-generated)
- Selected Vendor
- RTV Type
- Total Boxes Count
- Total Quantity
- Total Value (₹)
- Status Indicators (checklist):
  - ✓ Vendor Selected
  - ✓ RTV Type Selected
  - ✓ Boxes Scanned
  - ✓ All Details Filled
- Create RTV button
- Cancel button

## 🔧 Technical Implementation

### File Structure
```
app/[company]/reordering/
├── page.tsx                 # RTV Dashboard
└── create_rtv/
    └── page.tsx            # Create RTV Form

types/
└── rtv.ts                  # TypeScript types

lib/
└── mock-data/
    └── rtv-data.ts         # Mock data (temporary)
```

### Data Flow

#### 1. QR Code Scanning
```typescript
QR Code → Parse JSON → Extract Box Data → Validate → Add to List
```

#### 2. Box Data Structure
```typescript
{
  transaction_no: "CONS2024...",
  sku_id: 12345,
  material_type: "RM",
  item_description: "Wheat Flour",
  batch_number: "BATCH-001",
  quantity: 50,
  uom: "KG",
  net_weight: 50.5,
  manufacturing_date: "2024-10-01",
  expiry_date: "2025-10-01"
}
```

#### 3. RTV Submission
```typescript
{
  rtv_number: "RTV202410211530",
  vendor_code: "VEN-001",
  vendor_name: "ABC Suppliers Ltd",
  rtv_type: "quality_issue",
  grn_reference: "GRN-2024-001",
  dc_number: "DC-2024-001",
  notes: "Quality not meeting standards",
  created_by: "user@candor.com",
  total_value: 15000,
  total_quantity: 100,
  items: [
    {
      transaction_no: "CONS202410211530",
      sku_id: 12345,
      material_type: "RM",
      item_description: "Wheat Flour",
      batch_number: "BATCH-001",
      quantity: 50,
      net_weight: 50.5,
      uom: "KG",
      manufacturing_date: "2024-10-01",
      expiry_date: "2025-10-01",
      reason: "Moisture content too high",
      estimated_value: 2500
    }
  ]
}
```

## 🎨 UI/UX Features

### Responsive Design
- ✅ Mobile-first approach
- ✅ Tablet optimization
- ✅ Desktop layout with sticky sidebar
- ✅ Touch-friendly buttons and inputs

### Color Coding
- **Pending**: Yellow/Amber
- **Approved**: Green
- **Completed**: Blue
- **Rejected**: Red
- **Cancelled**: Gray

### Icons
- Status icons (CheckCircle, XCircle, Clock)
- Action icons (Camera, Trash, Eye, Save)
- Material type badges

### Validation
- Real-time form validation
- Required field indicators (*)
- Error messages with descriptions
- Status checklist in summary panel

## 🔌 Backend Integration Points

### APIs Required (to be implemented by backend team)

#### 1. Get Vendors List
```typescript
GET /api/vendors
Response: { vendors: [{ code, name }] }
```

#### 2. Fetch Box Details by Transaction
```typescript
GET /api/inward/{company}/{transaction_no}
Response: { box_data, articles }
```

#### 3. Create RTV
```typescript
POST /api/rtv/{company}/create
Body: RTVFormData
Response: { rtv_id, rtv_number, status }
```

#### 4. Get RTV List
```typescript
GET /api/rtv/{company}/list?page=1&per_page=10&status=pending
Response: { records, total, page, total_pages }
```

#### 5. Get RTV Details
```typescript
GET /api/rtv/{company}/{rtv_id}
Response: RTVRecord with items
```

#### 6. Update RTV Status
```typescript
PATCH /api/rtv/{company}/{rtv_id}/status
Body: { status: "approved" | "rejected", reason?: string }
```

## 🔄 Integration with Existing Modules

### Inward Module
- QR codes from inward boxes can be scanned
- Transaction numbers link back to GRN

### Outward Module
- Similar form structure and validation
- Reuses dropdown components

### Transfer Module
- QR scanner component reused
- Box scanning logic similar

## 📱 QR Code Format

### Expected QR Code JSON Structure
```json
{
  "transaction_no": "CONS202410211530",
  "tx": "CONS202410211530",
  "sku_id": 12345,
  "sk": 12345,
  "box_number": 1,
  "bx": 1,
  "material_type": "RM",
  "mt": "RM",
  "item_description": "Wheat Flour",
  "id": "Wheat Flour",
  "item_category": "Raw Materials",
  "ic": "Raw Materials",
  "sub_category": "Flour",
  "sc": "Flour",
  "batch_number": "BATCH-2024-001",
  "bt": "BATCH-2024-001",
  "quantity": 50,
  "qty": 50,
  "uom": "KG",
  "u": "KG",
  "net_weight": 50.5,
  "nw": 50.5,
  "manufacturing_date": "2024-10-01",
  "mfg": "2024-10-01",
  "expiry_date": "2025-10-01",
  "exp": "2025-10-01"
}
```

## 🚀 Next Steps

### Phase 1: Current (Mock Data) ✅
- [x] RTV Dashboard UI
- [x] Create RTV Form UI
- [x] QR Scanner Integration
- [x] Mock Data for Testing
- [x] Form Validation
- [x] Responsive Design

### Phase 2: Backend Integration (Pending)
- [ ] Connect to vendor API
- [ ] Connect to RTV creation API
- [ ] Connect to RTV list API
- [ ] Implement real-time data fetching
- [ ] Add authentication checks
- [ ] Add permission guards

### Phase 3: Advanced Features (Future)
- [ ] RTV approval workflow
- [ ] Email notifications to vendors
- [ ] PDF generation for RTV documents
- [ ] RTV history and tracking
- [ ] Analytics and reports
- [ ] Bulk RTV creation
- [ ] RTV amendment functionality

## 🎯 User Flow

1. User navigates to `/[company]/reordering`
2. Sees dashboard with statistics and RTV records
3. Clicks "Create RTV" button
4. Fills vendor and RTV type
5. Starts QR scanner
6. Scans boxes one by one
7. Each scanned box appears in list
8. User fills reason and value for each box
9. Reviews summary panel
10. Clicks "Create RTV" button
11. Success → Redirects to dashboard
12. New RTV appears in list with "Pending" status

## 🛠️ Development Notes

### Mock Data Location
- `lib/mock-data/rtv-data.ts` - Contains 5 sample RTV records
- Replace with actual API calls in Phase 2

### Components Used
- `HighPerformanceQRScanner` - From transfer module
- `SearchableSelect` - Reusable dropdown
- Standard shadcn/ui components (Button, Card, Input, etc.)

### State Management
- Local state using React hooks
- No external state management needed currently
- Can integrate with Zustand/Context if needed

### Styling
- Tailwind CSS
- Responsive breakpoints (sm, md, lg)
- Dark mode support (inherited from theme)

## 📞 Support

For backend integration queries, contact:
- Backend team for API endpoint specifications
- Frontend team for component modifications
- QA team for testing scenarios

---

**Last Updated**: October 21, 2025  
**Module Status**: ✅ Frontend Complete - Awaiting Backend Integration  
**Developer**: GitHub Copilot  
**Company**: Candor Foods
