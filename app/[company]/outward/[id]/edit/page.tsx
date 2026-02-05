"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SimpleDropdown } from "@/components/ui/simple-dropdown"
import { useSitecodes, useTransporters } from "@/lib/hooks/useDropdownData"
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  AlertCircle,
  RefreshCw
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getOutwardDetail, updateOutward } from "@/lib/api/outwardApiService"
import type { OutwardDetailResponse, OutwardFormData, DELIVERY_STATUS_OPTIONS, DeliveryStatus } from "@/types/outward"
import { DELIVERY_STATUS_OPTIONS as DELIVERY_STATUSES } from "@/types/outward"
import type { Company } from "@/lib/api"
import Link from "next/link"

// Business Head Email Mapping
const BUSINESS_HEAD_EMAILS: Record<string, string> = {
  "Rakesh Ratra": "rakesh@candorfoods.in",
  "Prashant Pal": "prashant@candorfoods.in",
  "Yash Gawdi": "yash@candorfoods.in",
  "Ajay Bajaj": "ajay@candorfoods.in"
}

// Indian States and Union Territories
const INDIAN_STATES_UTS = [
  // States (28)
  "ANDHRA PRADESH",
  "ARUNACHAL PRADESH",
  "ASSAM",
  "BIHAR",
  "CHHATTISGARH",
  "GOA",
  "GUJARAT",
  "HARYANA",
  "HIMACHAL PRADESH",
  "JHARKHAND",
  "KARNATAKA",
  "KERALA",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "ODISHA",
  "PUNJAB",
  "RAJASTHAN",
  "SIKKIM",
  "TAMIL NADU",
  "TELANGANA",
  "TRIPURA",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "WEST BENGAL",
  // Union Territories (8)
  "ANDAMAN AND NICOBAR ISLANDS",
  "CHANDIGARH",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DELHI",
  "JAMMU AND KASHMIR",
  "LADAKH",
  "LAKSHADWEEP",
  "PUDUCHERRY"
] as const

interface OutwardEditPageProps {
  params: {
    company: string
    id: string
  }
}

export default function OutwardEditPage({ params }: OutwardEditPageProps) {
  const router = useRouter()
  const company = params.company as Company
  const recordId = params.id

  const sitecodesHook = useSitecodes({ company, active_only: true })
  const transportersHook = useTransporters({ company, active_only: true })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<OutwardFormData | null>(null)

  // Fetch outward record
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getOutwardDetail(company, recordId)
        setFormData({
          company_name: data.company_name,
          consignment_no: data.consignment_no,
          invoice_no: data.invoice_no,
          customer_name: data.customer_name,
          location: data.location,
          po_no: data.po_no,
          boxes: data.boxes,
          gross_weight: data.gross_weight,
          net_weight: data.net_weight,
          appt_date: data.appt_date,
          appt_time: data.appt_time,
          sitecode: data.sitecode,
          asn_id: data.asn_id,
          transporter_name: data.transporter_name,
          vehicle_no: data.vehicle_no,
          lr_no: data.lr_no,
          dispatch_date: data.dispatch_date,
          estimated_delivery_date: data.estimated_delivery_date,
          actual_delivery_date: data.actual_delivery_date,
          delivery_status: data.delivery_status,
          invoice_amount: data.invoice_amount,
          invoice_gst_amount: data.invoice_gst_amount,
          total_invoice_amount: data.total_invoice_amount,
          freight_amount: data.freight_amount,
          freight_gst_amount: data.freight_gst_amount,
          total_freight_amount: data.total_freight_amount,
          billing_address: data.billing_address,
          shipping_address: data.shipping_address,
          pincode: data.pincode,
          business_head: data.business_head,
          business_head_name: data.business_head_name,
          business_head_email: data.business_head_email,
          invoice_files: data.invoice_files,
          pod_files: data.pod_files
        })
      } catch (error) {
        console.error("Error fetching outward record:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch outward record"
        setError(errorMessage)
        toast({
          title: "Error Loading Record",
          description: errorMessage,
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRecord()
  }, [company, recordId])

  // Auto-calculate totals when amounts change
  useEffect(() => {
    if (!formData) return
    
    const totalInvoice = (formData.invoice_amount || 0) + (formData.invoice_gst_amount || 0)
    const totalFreight = (formData.freight_amount || 0) + (formData.freight_gst_amount || 0)
    
    setFormData(prev => prev ? ({
      ...prev,
      total_invoice_amount: totalInvoice,
      total_freight_amount: totalFreight
    }) : null)
  }, [formData?.invoice_amount, formData?.invoice_gst_amount, formData?.freight_amount, formData?.freight_gst_amount])

  const handleInputChange = (field: keyof OutwardFormData, value: any) => {
    setFormData(prev => prev ? ({
      ...prev,
      [field]: value
    }) : null)
  }

  const handleSubmit = async () => {
    if (!formData) return

    // Validation
    if (!formData.consignment_no.trim()) {
      toast({
        title: "Validation Error",
        description: "Consignment number is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.customer_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)
      
      // Remove company_name from update (not in backend payload)
      const { company_name, ...formDataWithoutCompany } = formData
      
      // Use today's date as default for required date/time fields
      const today = new Date().toISOString().split('T')[0]
      
      const updateData: any = {
        ...formDataWithoutCompany,
        customer_name: formData.customer_name.toUpperCase(),
        location: formData.location ? formData.location.toUpperCase() : null,
        transporter_name: formData.transporter_name ? formData.transporter_name.toUpperCase() : null,
        vehicle_no: formData.vehicle_no ? formData.vehicle_no.toUpperCase() : null,
        billing_address: formData.billing_address ? formData.billing_address.toUpperCase() : null,
        shipping_address: formData.shipping_address ? formData.shipping_address.toUpperCase() : null,
        appt_date: formData.appt_date || today,
        appt_time: formData.appt_time ? `${formData.appt_time}:00` : "00:00:00",
        dispatch_date: formData.dispatch_date || today,
        estimated_delivery_date: formData.estimated_delivery_date || today,
        po_no: formData.po_no ? formData.po_no.toUpperCase() : null,
        sitecode: formData.sitecode || null,
        lr_no: formData.lr_no || null,
        business_head: formData.business_head || null,
        business_head_name: formData.business_head_name || null,
        business_head_email: formData.business_head_email,
      }

      console.log('Updating outward data:', updateData)

      await updateOutward(company, recordId, updateData)
      
      toast({
        title: "Success",
        description: "Outward record updated successfully"
      })

      // Navigate back to view page
      router.push(`/${company}/outward/${recordId}`)
    } catch (error) {
      console.error("Error updating outward record:", error)
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update outward record",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const generateLRNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    const second = String(now.getSeconds()).padStart(2, "0")
    const lrNumber = `${year}${month}${day}${hour}${minute}${second}`
    handleInputChange("lr_no", lrNumber)
    toast({
      title: "LR Number Generated",
      description: `LR Number: ${lrNumber}`
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Loading outward record...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/${company}/outward`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">Failed to load outward record</p>
            <p className="mt-2">{error || "Record not found"}</p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${company}/outward/${recordId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to View
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Edit Outward - {company.toUpperCase()}
            </h1>
            <p className="text-muted-foreground mt-1">
              Update consignment details
            </p>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="consignment_no">Consignment No *</Label>
              <Input
                id="consignment_no"
                value={formData.consignment_no}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div>
              <Label htmlFor="invoice_no">Invoice No *</Label>
              <Input
                id="invoice_no"
                value={formData.invoice_no}
                onChange={(e) => handleInputChange("invoice_no", e.target.value.toUpperCase())}
                placeholder="Enter invoice number"
              />
            </div>

            <div>
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange("customer_name", e.target.value.toUpperCase())}
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <Label htmlFor="delivery_status">Delivery Status</Label>
              <Select value={formData.delivery_status} onValueChange={(value) => handleInputChange("delivery_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location (State/UT)</Label>
              <Select 
                value={formData.location || ""} 
                onValueChange={(value) => handleInputChange("location", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state or union territory" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {INDIAN_STATES_UTS.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="po_no">PO Number</Label>
              <Input
                id="po_no"
                value={formData.po_no || ""}
                onChange={(e) => handleInputChange("po_no", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter PO number"
              />
            </div>

            <div>
              <Label htmlFor="boxes">Total Boxes</Label>
              <Input
                id="boxes"
                type="number"
                value={formData.boxes}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="net_weight">Net Weight (gm)</Label>
              <Input
                id="net_weight"
                value={formData.net_weight}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="gross_weight">Gross Weight (gm)</Label>
              <Input
                id="gross_weight"
                value={formData.gross_weight}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="business_head">Business Head</Label>
              <Select 
                value={formData.business_head || ""} 
                onValueChange={(value) => {
                  handleInputChange("business_head", value)
                  if (value !== "Other") {
                    // Auto-populate email for predefined business heads
                    const email = BUSINESS_HEAD_EMAILS[value] || null
                    handleInputChange("business_head_name", null)
                    handleInputChange("business_head_email", email)
                  } else {
                    // Clear both when "Other" is selected
                    handleInputChange("business_head_name", null)
                    handleInputChange("business_head_email", null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rakesh Ratra">Rakesh Ratra</SelectItem>
                  <SelectItem value="Prashant Pal">Prashant Pal</SelectItem>
                  <SelectItem value="Yash Gawdi">Yash Gawdi</SelectItem>
                  <SelectItem value="Ajay Bajaj">Ajay Bajaj</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.business_head === "Other" && (
              <>
                <div>
                  <Label htmlFor="business_head_name">Business Head Name *</Label>
                  <Input
                    id="business_head_name"
                    value={formData.business_head_name || ""}
                    onChange={(e) => handleInputChange("business_head_name", e.target.value)}
                    placeholder="Enter business head name"
                  />
                </div>

                <div>
                  <Label htmlFor="business_head_email">Business Head Email *</Label>
                  <Input
                    id="business_head_email"
                    type="email"
                    value={formData.business_head_email || ""}
                    onChange={(e) => handleInputChange("business_head_email", e.target.value)}
                    placeholder="Enter business head email"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointment & Site Details */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment & Site Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="appt_date">Appointment Date</Label>
              <Input
                id="appt_date"
                type="date"
                value={formData.appt_date}
                onChange={(e) => handleInputChange("appt_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="appt_time">Appointment Time</Label>
              <Input
                id="appt_time"
                type="time"
                value={formData.appt_time}
                onChange={(e) => handleInputChange("appt_time", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="sitecode">Site Code</Label>
              <SimpleDropdown
                value={formData.sitecode || ""}
                onValueChange={(value) => handleInputChange("sitecode", value)}
                placeholder="Select site code..."
                options={sitecodesHook.options}
                loading={sitecodesHook.loading}
                error={sitecodesHook.error}
              />
            </div>

            <div>
              <Label htmlFor="asn_id">ASN ID</Label>
              <Input
                id="asn_id"
                type="number"
                min="0"
                value={formData.asn_id}
                onChange={(e) => handleInputChange("asn_id", parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter ASN ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transport Details */}
      <Card>
        <CardHeader>
          <CardTitle>Transport Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="transporter_name">Transporter Name</Label>
              <SimpleDropdown
                value={formData.transporter_name || ""}
                onValueChange={(value) => handleInputChange("transporter_name", value)}
                placeholder="Select transporter..."
                options={transportersHook.options}
                loading={transportersHook.loading}
                error={transportersHook.error}
              />
            </div>

            <div>
              <Label htmlFor="vehicle_no">Vehicle Number</Label>
              <Input
                id="vehicle_no"
                value={formData.vehicle_no || ""}
                onChange={(e) => handleInputChange("vehicle_no", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="MH12AB1234"
              />
            </div>

            <div>
              <Label htmlFor="lr_no">LR Number</Label>
              <div className="flex gap-2">
                <Input
                  id="lr_no"
                  type="text"
                  value={formData.lr_no || ""}
                  onChange={(e) => handleInputChange("lr_no", e.target.value.trim() || null)}
                  placeholder="Enter LR number"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateLRNumber}
                  title="Generate LR Number"
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dispatch_date">Dispatch Date</Label>
              <Input
                id="dispatch_date"
                type="date"
                value={formData.dispatch_date}
                onChange={(e) => handleInputChange("dispatch_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="estimated_delivery_date">Est. Delivery Date</Label>
              <Input
                id="estimated_delivery_date"
                type="date"
                value={formData.estimated_delivery_date}
                onChange={(e) => handleInputChange("estimated_delivery_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="actual_delivery_date">Actual Delivery Date</Label>
              <Input
                id="actual_delivery_date"
                type="date"
                value={formData.actual_delivery_date || ""}
                onChange={(e) => handleInputChange("actual_delivery_date", e.target.value || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Details */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Invoice Section */}
            <div className="md:col-span-2">
              <h3 className="font-semibold text-sm mb-3">Invoice Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="invoice_amount">Invoice Amount</Label>
                  <Input
                    id="invoice_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.invoice_amount}
                    onChange={(e) => handleInputChange("invoice_amount", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="invoice_gst_amount">Invoice GST</Label>
                  <Input
                    id="invoice_gst_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.invoice_gst_amount}
                    onChange={(e) => handleInputChange("invoice_gst_amount", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="total_invoice_amount">Total Invoice</Label>
                  <Input
                    id="total_invoice_amount"
                    type="number"
                    value={formData.total_invoice_amount.toFixed(2)}
                    readOnly
                    className="bg-muted font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Freight Section */}
            <div className="md:col-span-2">
              <h3 className="font-semibold text-sm mb-3">Freight Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="freight_amount">Freight Amount</Label>
                  <Input
                    id="freight_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.freight_amount}
                    onChange={(e) => handleInputChange("freight_amount", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="freight_gst_amount">Freight GST</Label>
                  <Input
                    id="freight_gst_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.freight_gst_amount}
                    onChange={(e) => handleInputChange("freight_gst_amount", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="total_freight_amount">Total Freight</Label>
                  <Input
                    id="total_freight_amount"
                    type="number"
                    value={formData.total_freight_amount.toFixed(2)}
                    readOnly
                    className="bg-muted font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Details */}
      <Card>
        <CardHeader>
          <CardTitle>Address Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="billing_address">Billing Address</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address || ""}
                onChange={(e) => handleInputChange("billing_address", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter billing address"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="shipping_address">Shipping Address</Label>
              <Textarea
                id="shipping_address"
                value={formData.shipping_address || ""}
                onChange={(e) => handleInputChange("shipping_address", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter shipping address"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                type="number"
                min="0"
                value={formData.pincode}
                onChange={(e) => handleInputChange("pincode", parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter pincode"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pb-6">
        <Link href={`/${company}/outward/${recordId}`}>
          <Button variant="outline">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} className="gap-2" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

