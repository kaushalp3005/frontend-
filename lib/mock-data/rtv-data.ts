import { RTVRecord, RTVItem } from "@/types/rtv"

export const mockRTVItems: RTVItem[] = [
  {
    id: "item-1",
    material_code: "RM-001",
    material_name: "Wheat Flour",
    quantity: 50,
    unit: "KG",
    batch_number: "BATCH-2024-001",
    reason: "Quality not meeting standards",
    estimated_value: 2500,
  },
  {
    id: "item-2",
    material_code: "RM-002",
    material_name: "Sugar",
    quantity: 25,
    unit: "KG",
    batch_number: "BATCH-2024-002",
    reason: "Moisture content too high",
    estimated_value: 1500,
  },
]

export const mockRTVRecords: RTVRecord[] = [
  {
    id: "rtv-1",
    rtv_number: "RTV-2024-001",
    vendor_name: "ABC Suppliers Ltd",
    vendor_code: "VEN-001",
    rtv_type: "quality_issue",
    material_type: "RM",
    status: "pending",
    items: [mockRTVItems[0]],
    total_value: 2500,
    created_by: "John Doe",
    created_date: "2024-10-15",
    grn_reference: "GRN-2024-001",
    notes: "Quality inspection failed - material not meeting specifications",
  },
  {
    id: "rtv-2",
    rtv_number: "RTV-2024-002",
    vendor_name: "XYZ Trading Co",
    vendor_code: "VEN-002",
    rtv_type: "damaged",
    material_type: "PM",
    status: "approved",
    items: [
      {
        id: "item-3",
        material_code: "PM-001",
        material_name: "Plastic Containers",
        quantity: 100,
        unit: "PCS",
        batch_number: "BATCH-2024-003",
        reason: "Damaged during transit",
        estimated_value: 5000,
      },
    ],
    total_value: 5000,
    created_by: "Jane Smith",
    created_date: "2024-10-12",
    approved_by: "Manager Admin",
    approved_date: "2024-10-13",
    grn_reference: "GRN-2024-002",
    dc_number: "DC-2024-001",
  },
  {
    id: "rtv-3",
    rtv_number: "RTV-2024-003",
    vendor_name: "Global Foods Inc",
    vendor_code: "VEN-003",
    rtv_type: "expired",
    material_type: "RM",
    status: "completed",
    items: [
      {
        id: "item-4",
        material_code: "RM-003",
        material_name: "Milk Powder",
        quantity: 20,
        unit: "KG",
        batch_number: "BATCH-2024-004",
        reason: "Near expiry date",
        estimated_value: 3000,
      },
    ],
    total_value: 3000,
    created_by: "Mike Johnson",
    created_date: "2024-10-10",
    approved_by: "Manager Admin",
    approved_date: "2024-10-11",
    grn_reference: "GRN-2024-003",
  },
  {
    id: "rtv-4",
    rtv_number: "RTV-2024-004",
    vendor_name: "Premium Packaging",
    vendor_code: "VEN-004",
    rtv_type: "wrong_item",
    material_type: "PM",
    status: "rejected",
    items: [
      {
        id: "item-5",
        material_code: "PM-002",
        material_name: "Cardboard Boxes",
        quantity: 50,
        unit: "PCS",
        batch_number: "BATCH-2024-005",
        reason: "Wrong size delivered",
        estimated_value: 2000,
      },
    ],
    total_value: 2000,
    created_by: "Sarah Wilson",
    created_date: "2024-10-08",
    rejection_reason: "Vendor refused to accept return - agreement issue",
    notes: "Need to escalate to procurement team",
  },
  {
    id: "rtv-5",
    rtv_number: "RTV-2024-005",
    vendor_name: "ABC Suppliers Ltd",
    vendor_code: "VEN-001",
    rtv_type: "excess_quantity",
    material_type: "FG",
    status: "pending",
    items: [
      {
        id: "item-6",
        material_code: "FG-001",
        material_name: "Finished Product A",
        quantity: 30,
        unit: "UNITS",
        batch_number: "BATCH-2024-006",
        reason: "Excess quantity received",
        estimated_value: 4500,
      },
    ],
    total_value: 4500,
    created_by: "David Brown",
    created_date: "2024-10-18",
    grn_reference: "GRN-2024-005",
    dc_number: "DC-2024-002",
  },
]

// Helper function to get RTV records by status
export const getRTVByStatus = (status: RTVRecord["status"]) => {
  return mockRTVRecords.filter((rtv) => rtv.status === status)
}

// Helper function to get RTV by ID
export const getRTVById = (id: string) => {
  return mockRTVRecords.find((rtv) => rtv.id === id)
}

// Helper function to get statistics
export const getRTVStatistics = () => {
  return {
    total: mockRTVRecords.length,
    pending: getRTVByStatus("pending").length,
    approved: getRTVByStatus("approved").length,
    completed: getRTVByStatus("completed").length,
    rejected: getRTVByStatus("rejected").length,
    totalValue: mockRTVRecords.reduce((sum, rtv) => sum + rtv.total_value, 0),
  }
}
