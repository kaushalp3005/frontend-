"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import JobWorkDC from "@/components/transfer/JobWorkDC"

interface DCPageProps {
  params: {
    company: string
    challanId: string
  }
}

export default function JobWorkDCPage({ params }: DCPageProps) {
  const { company, challanId } = params
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // First check sessionStorage for just-submitted data
    const sessionKey = `jw-dc-${challanId}`
    const cached = sessionStorage.getItem(sessionKey)
    if (cached) {
      try {
        setData(JSON.parse(cached))
        setLoading(false)
        return
      } catch { /* fall through to API */ }
    }

    // Fetch from API
    const fetchData = async () => {
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out/${encodeURIComponent(challanId)}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error(`Failed to load challan: ${res.status}`)
        const result = await res.json()
        setData(result)
      } catch (e: any) {
        setError(e.message || "Failed to load delivery challan data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [challanId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
          <p className="text-sm text-gray-600">Loading Delivery Challan...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error || "No data found"}</p>
          <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">Go Back</button>
        </div>
      </div>
    )
  }

  // Map data to JobWorkDC props
  // Data can come from two sources:
  //   1. sessionStorage (material-out submit): has header, line_items, company, totals
  //   2. API /job-work/out/{challan}: flat structure with items, from_warehouse, driver_name etc at root
  const isFromApi = !data.header && !data.line_items

  const companyInfo = data.company || {
    name: "CANDOR DATES PRIVATE LIMITED",
    address: "W-202A, MIDC, TTC INDUSTRIAL AREA, KHAIRNE, MIDC, NAVI MUMBAI, THANE 400710",
    gstin: "27AAKCC3130A1Z9",
    fssai_no: "11522998001846",
    state: "Maharashtra",
    state_code: "27",
    email: "accounts@candorfoods.in",
  }

  const header = data.header || {}
  const dispatchTo = { ...(data.dispatch_to || data.party || {}), sub_category: (data.dispatch_to || data.party || {}).sub_category || data.sub_category || header.sub_category || '' }
  const rawItems = data.line_items || data.items || []
  const totalsData = data.totals || {}

  const lineItems = rawItems.map((item: any, idx: number) => ({
    sl_no: item.sl_no || idx + 1,
    item_description: item.item_description || item.description || '',
    hsn_sac: item.hsn_sac || '08041020',
    gst_rate: item.gst_rate || '0%',
    material_type: item.material_type || '',
    item_category: item.item_category || '',
    sub_category: item.sub_category || '',
    uom: item.uom || 'KG',
    unit_pack_size: item.unit_pack_size || '',
    quantity_boxes: (item.quantity_boxes ?? item.quantity?.boxes ?? parseInt(item.case_pack)) || 0,
    net_weight: parseFloat(item.net_weight || item.quantity?.kgs) || 0,
    total_weight: parseFloat(item.total_weight || item.net_weight || item.quantity?.kgs) || 0,
    lot_number: item.lot_number || item.batch_number || '',
    rate_per_kg: parseFloat(item.rate_per_kg) || 0,
    amount: parseFloat(item.amount) || 0,
    remarks: item.remarks || '',
  }))

  const totalBoxes = lineItems.reduce((s: number, e: any) => s + (e.quantity_boxes || 0), 0)
  const totalKgs = lineItems.reduce((s: number, e: any) => s + (e.net_weight || 0), 0)
  const totalAmount = lineItems.reduce((s: number, e: any) => s + (e.amount || 0), 0)

  return (
    <JobWorkDC
      challanNo={data.challan_no || header.challan_no || challanId}
      dated={data.dated || header.job_work_date || (isFromApi ? data.job_work_date : '') || ''}
      fromWarehouse={header.from_warehouse || (isFromApi ? data.from_warehouse : '') || ''}
      eWayBillNo={data.e_way_bill_no || ''}
      dispatchedThrough={data.dispatched_through || ''}
      motorVehicleNo={data.motor_vehicle_no || header.vehicle_no || (isFromApi ? data.vehicle_no : '') || ''}
      driverName={header.driver_name || (isFromApi ? data.driver_name : '') || ''}
      authorizedPerson={header.authorized_person || (isFromApi ? data.authorized_person : '') || ''}
      purposeOfWork={header.purpose_of_work || (isFromApi ? data.purpose_of_work : '') || ''}
      remarks={data.remarks || header.remarks || ''}
      expectedReturnDate={header.expected_return_date || (isFromApi ? data.expected_return_date : '') || ''}
      company={companyInfo}
      dispatchTo={dispatchTo}
      lineItems={lineItems}
      totals={{
        total_quantity_kgs: totalsData.total_quantity_kgs || totalKgs,
        total_boxes: totalBoxes,
        total_amount: totalsData.total_amount || totalAmount,
      }}
    />
  )
}
