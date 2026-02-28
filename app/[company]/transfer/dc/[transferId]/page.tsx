"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import DeliveryChallan from "@/components/transfer/DeliveryChallan"
import { InterunitApiService } from "@/lib/interunitApiService"
import { WAREHOUSE_ADDRESSES } from "@/lib/constants/warehouses"
import type { Company } from "@/types/auth"

interface DCPageProps {
  params: {
    company: Company
    transferId: string
  }
}

export default function DCPage({ params }: DCPageProps) {
  const { company, transferId } = params
  
  const [loading, setLoading] = useState(true)
  const [transferData, setTransferData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransferDetails = async () => {
      try {
        setLoading(true)
        console.log('🔍 Fetching transfer details for ID:', transferId)
        const response = await InterunitApiService.getTransferById(company, transferId)
        console.log('✅ DC Data received:', response)
        console.log('📦 Items/Lines:', response.lines || response.items)
        console.log('🚚 Vehicle:', response.vehicle_no || response.vehicle_number)
        console.log('👤 Driver:', response.driver_name)
        console.log('✓ Approved by:', response.approved_by || response.approval_authority)
        setTransferData(response)
      } catch (err: any) {
        console.error('❌ Error loading DC:', err)
        setError(err.message || 'Failed to load transfer details')
      } finally {
        setLoading(false)
      }
    }

    if (transferId) {
      fetchTransferDetails()
    }
  }, [transferId, company])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading DC...</p>
        </div>
      </div>
    )
  }

  if (error || !transferData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Error: {error || 'Transfer not found'}</p>
      </div>
    )
  }

  return (
    <DeliveryChallan
      dcNumber={transferData.challan_no || transferData.request_no || 'N/A'}
      requestDate={transferData.transfer_date || transferData.stock_trf_date}
      fromWarehouse={transferData.from_warehouse || transferData.from_site}
      toWarehouse={transferData.to_warehouse || transferData.to_site}
      vehicleNumber={transferData.vehicle_number || transferData.vehicle_no || 'N/A'}
      driverName={transferData.driver_name || 'N/A'}
      approvalAuthority={transferData.approval_authority || transferData.approved_by || 'N/A'}
      reasonDescription={transferData.reason_code || transferData.remark || 'N/A'}
      items={transferData.lines || transferData.items || []}
      totalQtyRequired={transferData.total_qty_required || 0}
      boxesProvided={transferData.boxes_provided || transferData.boxes_count || 0}
      boxesPending={transferData.boxes_pending || transferData.pending_items || 0}
      warehouseAddresses={WAREHOUSE_ADDRESSES}
    />
  )
}
