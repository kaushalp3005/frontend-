# 🚀 Backend Integration Guide - RTV Module

## Backend URL
```
https://mmvxmfvhmq.ap-south-1.awsapprunner.com
```

## ✅ Setup Complete

### 1. Environment Variable Created
**File**: `.env.local`
```env
NEXT_PUBLIC_API_URL=https://mmvxmfvhmq.ap-south-1.awsapprunner.com
```

### 2. API Service Created
**File**: `lib/api/rtvApiService.ts`

Contains all RTV-related API functions:
- `getRTVList()` - Get RTV records with pagination
- `getRTVById()` - Get single RTV details
- `createRTV()` - Create new RTV
- `updateRTVStatus()` - Update RTV status
- `getVendors()` - Get vendor list
- `getBoxDetails()` - Get box/transaction details

---

## 📋 Backend API Endpoints Required

### 1. Get RTV List
```
GET /rtv/{company}/list?page=1&per_page=10&status=pending&search=ABC
```

**Query Parameters**:
- `page` (optional) - Page number (default: 1)
- `per_page` (optional) - Records per page (default: 10)
- `status` (optional) - Filter by status (pending/approved/rejected/completed)
- `search` (optional) - Search by RTV number or vendor
- `sort_by` (optional) - Sort field
- `sort_order` (optional) - asc/desc

**Response Format**:
```json
{
  "records": [
    {
      "id": "rtv-1",
      "rtv_number": "RTV202410211530",
      "vendor_name": "ABC Suppliers Ltd",
      "vendor_code": "VEN-001",
      "rtv_type": "quality_issue",
      "material_type": "RM",
      "status": "pending",
      "items": [...],
      "total_value": 15000,
      "created_by": "user@email.com",
      "created_date": "2024-10-21",
      "grn_reference": "GRN-2024-001",
      "dc_number": "DC-2024-001",
      "notes": "Quality not meeting standards"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 10,
  "total_pages": 5,
  "pending_count": 10,
  "approved_count": 20,
  "completed_count": 15,
  "rejected_count": 5,
  "total_value": 500000
}
```

---

### 2. Get RTV by ID
```
GET /rtv/{company}/{rtv_id}
```

**Response Format**:
```json
{
  "id": "rtv-1",
  "rtv_number": "RTV202410211530",
  "vendor_name": "ABC Suppliers Ltd",
  "vendor_code": "VEN-001",
  "rtv_type": "quality_issue",
  "material_type": "RM",
  "status": "pending",
  "items": [
    {
      "id": "item-1",
      "material_code": "RM-001",
      "material_name": "Wheat Flour",
      "quantity": 50,
      "unit": "KG",
      "batch_number": "BATCH-2024-001",
      "reason": "Quality not meeting standards",
      "estimated_value": 2500
    }
  ],
  "total_value": 15000,
  "created_by": "user@email.com",
  "created_date": "2024-10-21",
  "approved_by": "manager@email.com",
  "approved_date": "2024-10-22",
  "grn_reference": "GRN-2024-001",
  "dc_number": "DC-2024-001",
  "notes": "Quality not meeting standards"
}
```

---

### 3. Create RTV
```
POST /rtv/{company}/create
```

**Request Body**:
```json
{
  "rtv_number": "RTV202410211530",
  "vendor_code": "VEN-001",
  "vendor_name": "ABC Suppliers Ltd",
  "rtv_type": "quality_issue",
  "grn_reference": "GRN-2024-001",
  "dc_number": "DC-2024-001",
  "notes": "Quality not meeting standards",
  "created_by": "user@email.com",
  "total_value": 15000,
  "total_quantity": 100,
  "items": [
    {
      "transaction_no": "CONS202410211530",
      "sku_id": 12345,
      "material_type": "RM",
      "item_description": "Wheat Flour",
      "batch_number": "BATCH-2024-001",
      "quantity": 50,
      "net_weight": 50.5,
      "uom": "KG",
      "manufacturing_date": "2024-10-01",
      "expiry_date": "2025-10-01",
      "reason": "Moisture content too high",
      "estimated_value": 2500
    }
  ]
}
```

**Response Format**:
```json
{
  "rtv_id": "rtv-123",
  "rtv_number": "RTV202410211530",
  "status": "pending",
  "message": "RTV created successfully"
}
```

---

### 4. Update RTV Status
```
PATCH /rtv/{company}/{rtv_id}/status
```

**Request Body**:
```json
{
  "status": "approved",
  "reason": "Optional rejection reason"
}
```

**Response Format**:
```json
{
  "success": true,
  "message": "RTV status updated successfully"
}
```

---

### 5. Get Vendors List
```
GET /vendors/{company}
```

**Response Format**:
```json
[
  {
    "code": "VEN-001",
    "name": "ABC Suppliers Ltd"
  },
  {
    "code": "VEN-002",
    "name": "XYZ Trading Co"
  }
]
```

---

### 6. Get Box/Transaction Details (for QR scanning)
```
GET /inward/{company}/{transaction_no}
```

**Response Format**:
```json
{
  "transaction_no": "CONS202410211530",
  "articles": [
    {
      "sku_id": 12345,
      "box_number": 1,
      "material_type": "RM",
      "item_description": "Wheat Flour",
      "batch_number": "BATCH-2024-001",
      "quantity": 50,
      "uom": "KG",
      "net_weight": 50.5,
      "manufacturing_date": "2024-10-01",
      "expiry_date": "2025-10-01"
    }
  ]
}
```

---

## 🔧 How to Use

### Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl + C)
npm run dev
```

The `.env.local` file will be loaded automatically.

### Step 2: Test Backend Connection

Open browser console and test:
```javascript
// Test if API URL is loaded
console.log(process.env.NEXT_PUBLIC_API_URL)
// Should print: https://mmvxmfvhmq.ap-south-1.awsapprunner.com
```

### Step 3: Replace Mock Data in Pages

#### A. Dashboard (`app/[company]/reordering/page.tsx`)

Replace the mock import with API service:

```typescript
// Remove this:
import { mockRTVRecords, getRTVStatistics } from "@/lib/mock-data/rtv-data"

// Add this:
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVRecord } from "@/types/rtv"

// Inside component, add state:
const [records, setRecords] = useState<RTVRecord[]>([])
const [loading, setLoading] = useState(true)
const [stats, setStats] = useState({
  total: 0,
  pending: 0,
  approved: 0,
  completed: 0,
  rejected: 0,
  totalValue: 0,
})

// Replace hardcoded filtering with API call:
useEffect(() => {
  const fetchRTVs = async () => {
    try {
      setLoading(true)
      const data = await rtvApi.getRTVList(params.company, {
        page: 1,
        per_page: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery,
      })
      
      setRecords(data.records)
      setStats({
        total: data.total,
        pending: data.pending_count || 0,
        approved: data.approved_count || 0,
        completed: data.completed_count || 0,
        rejected: data.rejected_count || 0,
        totalValue: data.total_value || 0,
      })
    } catch (error) {
      console.error("Error fetching RTVs:", error)
      toast({
        title: "Error",
        description: "Failed to load RTV records",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  
  fetchRTVs()
}, [params.company, statusFilter, searchQuery])

// Update filteredRecords to use state:
const filteredRecords = records
```

#### B. Create RTV (`app/[company]/reordering/create_rtv/page.tsx`)

Update the submit handler:

```typescript
// Add import:
import { rtvApi } from "@/lib/api/rtvApiService"

// In handleSubmit function, replace mock submission:
const handleSubmit = async () => {
  if (!validateForm()) return

  try {
    const rtvData = {
      rtv_number: rtvNumber,
      vendor_code: formData.vendorCode,
      vendor_name: formData.vendorName,
      rtv_type: formData.rtvType,
      grn_reference: formData.grnReference,
      dc_number: formData.dcNumber,
      notes: formData.notes,
      created_by: formData.createdBy,
      total_value: totalValue,
      total_quantity: totalQuantity,
      items: scannedBoxes.map((box) => ({
        transaction_no: box.transactionNo,
        sku_id: box.skuId,
        material_type: box.materialType,
        item_description: box.itemDescription,
        batch_number: box.batchNumber,
        quantity: box.quantity,
        net_weight: box.netWeight,
        uom: box.uom,
        manufacturing_date: box.manufacturingDate,
        expiry_date: box.expiryDate,
        reason: box.reason,
        estimated_value: box.estimatedValue,
      })),
    }

    // API call instead of console.log
    const result = await rtvApi.createRTV(params.company, rtvData)

    toast({
      title: "✅ RTV Created Successfully",
      description: `RTV ${result.rtv_number} has been created`,
    })

    router.push(`/${params.company}/reordering`)
  } catch (error: any) {
    console.error("Error creating RTV:", error)
    toast({
      title: "❌ Failed to Create RTV",
      description: error.message || "An error occurred",
      variant: "destructive",
    })
  }
}
```

#### C. View RTV (`app/[company]/reordering/[id]/page.tsx`)

Replace mock data fetch:

```typescript
// Add import:
import { rtvApi } from "@/lib/api/rtvApiService"

// Replace useEffect:
useEffect(() => {
  const fetchRTV = async () => {
    try {
      setLoading(true)
      const data = await rtvApi.getRTVById(params.company, params.id)
      setRtvRecord(data)
    } catch (error) {
      console.error("Error fetching RTV:", error)
      toast({
        title: "Error",
        description: "Failed to load RTV details",
        variant: "destructive",
      })
      setRtvRecord(null)
    } finally {
      setLoading(false)
    }
  }
  
  fetchRTV()
}, [params.company, params.id])
```

---

## 🧪 Testing Checklist

### 1. Environment Variable
- [ ] `.env.local` file created
- [ ] `NEXT_PUBLIC_API_URL` set correctly
- [ ] Dev server restarted
- [ ] Console shows correct URL

### 2. API Endpoints
Contact backend team to verify these endpoints exist:
- [ ] GET `/rtv/{company}/list`
- [ ] GET `/rtv/{company}/{id}`
- [ ] POST `/rtv/{company}/create`
- [ ] PATCH `/rtv/{company}/{id}/status`
- [ ] GET `/vendors/{company}`
- [ ] GET `/inward/{company}/{transaction_no}`

### 3. Test Each Feature
- [ ] Dashboard loads RTV list from backend
- [ ] Statistics show correct counts
- [ ] Search functionality works
- [ ] Filters work correctly
- [ ] Create RTV submits to backend
- [ ] View RTV loads details from backend
- [ ] QR scanner fetches box details (if TX transaction)

---

## 🐛 Troubleshooting

### API URL Not Loading
```bash
# 1. Check .env.local exists in root directory
# 2. Restart dev server completely
# 3. Clear Next.js cache
rm -rf .next
npm run dev
```

### CORS Errors
Backend team needs to add CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Network Errors
1. Check if backend URL is accessible
2. Open: https://mmvxmfvhmq.ap-south-1.awsapprunner.com in browser
3. Check browser console for errors
4. Check Network tab in DevTools

### Authentication Issues
If backend requires authentication:
```typescript
// Add to API calls:
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`, // Add your auth token
}
```

---

## 📝 Next Steps

1. **Verify Backend Endpoints**
   - Contact backend team
   - Share the API endpoint requirements above
   - Get exact response formats

2. **Update API Service**
   - Modify `lib/api/rtvApiService.ts` if response format differs
   - Add error handling for specific status codes
   - Add authentication if required

3. **Replace Mock Data**
   - Follow Step 3 above for each page
   - Test each feature thoroughly
   - Remove mock data files once confirmed working

4. **Production Deployment**
   - Add production API URL to environment variables
   - Test in staging environment
   - Deploy to production

---

## 🎯 Summary

✅ **Setup Complete**:
- Environment variable configured
- API service created
- Backend URL ready: `https://mmvxmfvhmq.ap-south-1.awsapprunner.com`

📋 **Action Items**:
1. Restart dev server
2. Verify backend endpoints with backend team
3. Replace mock data in pages (follow Step 3)
4. Test all features
5. Fix any response format mismatches

🚀 **Ready to integrate!**

---

**Need Help?**
- Check console logs for detailed error messages
- Review `lib/api/rtvApiService.ts` for API call structure
- Contact backend team for endpoint verification
