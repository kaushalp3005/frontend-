"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { 
  ArrowLeft, 
  Save, 
  Camera, 
  Package, 
  AlertCircle, 
  Trash2, 
  CheckCircle,
  XCircle,
  RotateCcw,
  Printer,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import type { Company } from "@/types/auth"
import { RTVType, MaterialType } from "@/types/rtv"
import { rtvApi, type Customer, type CreateRTVRequest } from "@/lib/api/rtvApiService"

interface CreateRTVPageProps {
  params: {
    company: Company
  }
}

// RTV Types with labels
const RTV_TYPES: { value: RTVType; label: string; description: string }[] = [
  { value: "quality_issue", label: "Quality Issue", description: "Material not meeting quality standards" },
  { value: "damaged", label: "Damaged", description: "Material damaged during transit or storage" },
  { value: "expired", label: "Expired", description: "Material expired or near expiry" },
  { value: "excess_quantity", label: "Excess Quantity", description: "Received more than ordered" },
  { value: "wrong_item", label: "Wrong Item", description: "Incorrect item received" },
  { value: "other", label: "Other", description: "Other reasons" },
]

interface ScannedBox {
  id: number
  boxNumber: number
  transactionNo: string
  subCategory: string
  itemDescription: string
  netWeight: number
  grossWeight: number
  price: number
  reason: string
  qrData: any
}

export default function CreateRTVPage({ params }: CreateRTVPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()

  // Generate RTV number
  const generateRTVNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    return `RTV${year}${month}${day}${hours}${minutes}`
  }

  const [rtvNumber, setRtvNumber] = useState(generateRTVNumber())

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // API States
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    customerCode: "",
    customerName: "",
    customCustomerName: "", // For "Other" option
    rtvType: "" as RTVType | "",
    otherReason: "",
    rtvDate: getCurrentDate(),
    invoiceNumber: "",
    dcNumber: "",
    notes: "",
    createdBy: "Current User", // Replace with actual user from auth
  })

  // Scanned boxes
  const [scannedBoxes, setScannedBoxes] = useState<ScannedBox[]>([])
  const boxIdCounterRef = useRef(1)
  const isProcessingRef = useRef(false)

  // Scanner control
  const [showScanner, setShowScanner] = useState(false)

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load customers from API on component mount
  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoadingCustomers(true)
      try {
        console.log('🔄 Loading customers for company:', company)
        const response = await rtvApi.getCustomers(company)
        console.log('✅ Customers loaded:', response.data)
        setCustomers(response.data)
      } catch (error) {
        console.error('❌ Error loading customers:', error)
        console.warn('⚠️ Backend RTV API not available, using fallback customer list')
        
        // Fallback customer list (when backend is not ready)
        const fallbackCustomers: Customer[] = [
          { value: "CUST001", label: "Customer 1" },
          { value: "CUST002", label: "Customer 2" },
          { value: "CUST003", label: "Customer 3" },
          { value: "OTHER", label: "Other (Enter Custom Name)" }
        ]
        
        setCustomers(fallbackCustomers)
        
        toast({
          title: "⚠️ Using Offline Mode",
          description: "Customer list loaded from cache. Backend API not available.",
        })
      } finally {
        setIsLoadingCustomers(false)
      }
    }

    loadCustomers()
  }, [company, toast])

  // Load scanned boxes from localStorage on component mount (for page reload)
  useEffect(() => {
    const savedBoxes = localStorage.getItem('rtv_scanned_boxes')
    const savedCounter = localStorage.getItem('rtv_box_counter')
    const savedFormData = localStorage.getItem('rtv_form_data')
    
    if (savedBoxes) {
      try {
        const boxes = JSON.parse(savedBoxes)
        setScannedBoxes(boxes)
        console.log('📦 Restored', boxes.length, 'scanned boxes from localStorage')
      } catch (error) {
        console.error('Failed to parse saved boxes:', error)
        localStorage.removeItem('rtv_scanned_boxes')
      }
    }
    
    if (savedCounter) {
      boxIdCounterRef.current = parseInt(savedCounter, 10)
    }
    
    if (savedFormData) {
      try {
        const data = JSON.parse(savedFormData)
        setFormData((prev) => ({ ...prev, ...data }))
        console.log('📝 Restored form data from localStorage')
      } catch (error) {
        console.error('Failed to parse saved form data:', error)
        localStorage.removeItem('rtv_form_data')
      }
    }

    // Cleanup function - Clear localStorage when component unmounts (navigating away)
    return () => {
      localStorage.removeItem('rtv_scanned_boxes')
      localStorage.removeItem('rtv_box_counter')
      localStorage.removeItem('rtv_form_data')
      console.log('🧹 Cleared RTV data from localStorage on navigation')
    }
  }, [])

  // Save scanned boxes to localStorage whenever they change (for page reload)
  useEffect(() => {
    if (scannedBoxes.length > 0) {
      localStorage.setItem('rtv_scanned_boxes', JSON.stringify(scannedBoxes))
      localStorage.setItem('rtv_box_counter', boxIdCounterRef.current.toString())
    } else {
      localStorage.removeItem('rtv_scanned_boxes')
      localStorage.removeItem('rtv_box_counter')
    }
  }, [scannedBoxes])

  // Save form data to localStorage whenever it changes (for page reload)
  useEffect(() => {
    const dataToSave = {
      customerCode: formData.customerCode,
      customerName: formData.customerName,
      customCustomerName: formData.customCustomerName,
      rtvType: formData.rtvType,
      otherReason: formData.otherReason,
      invoiceNumber: formData.invoiceNumber,
      notes: formData.notes,
    }
    localStorage.setItem('rtv_form_data', JSON.stringify(dataToSave))
  }, [formData])

  // Handle customer change
  const handleCustomerChange = (customerCode: string) => {
    const customer = customers.find((v) => v.value === customerCode)
    setFormData((prev) => ({
      ...prev,
      customerCode,
      customerName: customerCode === "OTHER" ? "" : (customer?.label || ""),
      customCustomerName: customerCode !== "OTHER" ? "" : prev.customCustomerName, // Clear if not "OTHER"
    }))
    setErrors((prev) => ({ ...prev, customerCode: "", customCustomerName: "" }))
  }

  // Handle RTV type change
  const handleRTVTypeChange = (rtvType: string) => {
    setFormData((prev) => ({
      ...prev,
      rtvType: rtvType as RTVType,
      otherReason: rtvType !== "other" ? "" : prev.otherReason, // Clear otherReason if not "other"
    }))
    setErrors((prev) => ({ ...prev, rtvType: "", otherReason: "" }))
  }

  // Handle QR scan success
  // Supports two types of QR codes:
  // 1. Original CONS/TR QR codes (cn/tx, bx, sc/it, id/it, nw, gw/tw)
  // 2. RTV QR codes (type: "RTV", rtv_number, all box details + form data)
  const handleQRScanSuccess = async (decodedText: string) => {
    if (isProcessingRef.current) {
      console.log("⏭️ Already processing a scan, skipping...")
      return
    }

    isProcessingRef.current = true
    console.log("📱 QR Code Scanned:", decodedText)

    // Close scanner immediately
    setShowScanner(false)

    // Add a small delay to prevent multiple triggers
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      // Parse QR code
      const qrData = JSON.parse(decodedText)
      console.log("📦 Raw QR Data:", qrData)

      let transactionNo: string
      let boxNumber: number | string
      let subCategory: string
      let itemDescription: string
      let netWeight: number
      let grossWeight: number
      let price: number = 0

      // Check if this is an RTV QR code
      if (qrData.type === "RTV" && qrData.rtv_number) {
        console.log("🔄 RTV QR Code detected - Auto-filling from RTV data")
        
        // Extract data from RTV QR code
        transactionNo = qrData.transaction_no || "N/A"
        boxNumber = qrData.box_number || boxIdCounterRef.current
        subCategory = qrData.sub_category || ""
        itemDescription = qrData.item_description || ""
        netWeight = parseFloat(qrData.net_weight || "0")
        grossWeight = parseFloat(qrData.gross_weight || "0")
        price = parseFloat(qrData.price || "0")

        // Also fill form data if available
        if (qrData.customer_code && !formData.customerCode) {
          setFormData((prev) => ({
            ...prev,
            customerCode: qrData.customer_code,
            customerName: qrData.customer_name || "",
            rtvType: qrData.rtv_type || prev.rtvType,
            dcNumber: qrData.dc_number || prev.dcNumber,
            invoiceNumber: qrData.invoice_number || prev.invoiceNumber,
          }))
          
          toast({
            title: "📋 Form Auto-filled",
            description: `Customer and RTV details loaded from QR code`,
          })
        }

        toast({
          title: "🔄 RTV Box Detected",
          description: `Scanning previously created RTV box from ${qrData.rtv_number}`,
        })
      } else {
        // Original QR format mapping:
        // cn or tx = transaction/cons number
        // sc = sub category (may not exist)
        // id or it = item description
        // nw = net weight
        // gw or tw = gross/total weight
        // bx = box number
        transactionNo = qrData.cn || qrData.tx || "N/A"
        boxNumber = qrData.bx || boxIdCounterRef.current
        subCategory = qrData.sc || qrData.it || ""
        itemDescription = qrData.id || qrData.it || ""
        netWeight = parseFloat(qrData.nw || "0")
        grossWeight = parseFloat(qrData.gw || qrData.tw || "0")
      }

      console.log("🔍 Parsed QR Data:", { 
        transactionNo, 
        boxNumber, 
        subCategory, 
        itemDescription, 
        netWeight, 
        grossWeight,
        price 
      })

      // Check for duplicate in current RTV form (same form)
      const isDuplicateLocal = scannedBoxes.some(
        (box) => box.transactionNo === transactionNo
      )

      if (isDuplicateLocal) {
        toast({
          title: "⚠️ Already Scanned in This Form",
          description: `Transaction ${transactionNo} is already added to this RTV`,
          variant: "destructive",
        })
        console.warn("⚠️ Duplicate scan prevented (same RTV form):", transactionNo)
        
        // Unlock the scanner after showing error
        setTimeout(() => {
          isProcessingRef.current = false
        }, 500)
        
        return // Exit early - prevent duplicate in same form
      }

      // Skip backend validation for now - only check locally in current form
      // Backend validation is too strict (blocks cross-RTV usage)
      console.log('✅ Box passed local validation, adding to form')

      // Add box to scanned boxes array
      setScannedBoxes((prevBoxes) => {
        // Create scanned box entry
        const newBox: ScannedBox = {
          id: boxIdCounterRef.current++,
          boxNumber: typeof boxNumber === 'number' ? boxNumber : parseInt(boxNumber) || boxIdCounterRef.current,
          transactionNo: transactionNo,
          subCategory: subCategory,
          itemDescription: itemDescription,
          netWeight: netWeight,
          grossWeight: grossWeight,
          price: price, // Auto-filled from RTV QR or 0 for new scans
          reason: "", // User will fill this
          qrData: qrData,
        }

        console.log("✅ New box added:", newBox)

        toast({
          title: "✅ Box Scanned Successfully",
          description: `Box #${newBox.boxNumber} - ${newBox.itemDescription}`,
        })

        return [...prevBoxes, newBox]
      })

    } catch (error) {
      console.error("Error processing QR code:", error)
      toast({
        title: "❌ Invalid QR Code",
        description: "Could not parse QR code data",
        variant: "destructive",
      })
    } finally {
      // Longer delay before allowing next scan
      setTimeout(() => {
        isProcessingRef.current = false
        console.log("✅ Ready for next scan")
      }, 500)
    }
  }

  // Update box field
  const updateBox = (boxId: number, field: keyof ScannedBox, value: any) => {
    setScannedBoxes((prev) =>
      prev.map((box) => (box.id === boxId ? { ...box, [field]: value } : box))
    )
  }

  // Remove box
  const removeBox = (boxId: number) => {
    setScannedBoxes((prev) => prev.filter((box) => box.id !== boxId))
    toast({
      title: "Box Removed",
      description: "Box removed from RTV list",
    })
  }

  // Generate and print RTV QR code for a box
  const handlePrintRTVQR = async (box: ScannedBox) => {
    try {
      // Dynamically import QRCode library
      const QRCode = (await import('qrcode')).default

      // Create RTV QR data combining original box data with RTV number
      const rtvQRData = {
        type: "RTV",
        rtv_number: rtvNumber,
        transaction_no: box.transactionNo,
        box_number: box.boxNumber,
        item_description: box.itemDescription,
        sub_category: box.subCategory,
        net_weight: box.netWeight, // Weight in grams
        gross_weight: box.grossWeight, // Weight in grams
        price: box.price,
        customer_code: formData.customerCode,
        customer_name: formData.customerCode === "OTHER" ? formData.customCustomerName : formData.customerName,
        rtv_date: formData.rtvDate,
        rtv_type: formData.rtvType,
        dc_number: formData.dcNumber,
        invoice_number: formData.invoiceNumber,
      }

      // Convert to JSON string for QR code
      const qrDataString = JSON.stringify(rtvQRData)

      // Generate QR code as Data URL (optimized for 2-inch label)
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'H'
      })

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=500')
      
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>RTV Label - ${rtvNumber}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              /* Print-optimized sizes: 4 inch width x 2 inch height */
              @page {
                size: 4in 2in;
                margin: 0;
              }
              
              body {
                font-family: Arial, sans-serif;
                background: white;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 10px;
              }
              
              .label {
                width: 4in;
                height: 2in;
                border: 2px solid #000;
                display: flex;
                background: white;
                box-sizing: border-box;
              }
              
              .qr-side {
                flex: 0 0 2in;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 8px;
                border-right: 1px solid #ccc;
              }
              
              .info-side {
                flex: 1;
                padding: 12px 15px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
              }
              
              .rtv-number {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 3px;
                letter-spacing: 0.3px;
                line-height: 1.1;
                word-break: break-all;
                overflow-wrap: break-word;
              }
              
              .customer {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                margin-bottom: 8px;
                line-height: 1;
              }
              
              .item-name {
                font-size: 13px;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 8px;
                line-height: 1.1;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
              }
              
              .detail-line {
                font-size: 10px;
                margin: 2px 0;
                font-weight: 500;
                line-height: 1.2;
              }
              
              .transaction {
                font-size: 9px;
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px solid #ddd;
                letter-spacing: 0.3px;
                line-height: 1;
              }
              
              .no-print {
                display: none;
              }
              
              .button-container {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 10px;
                z-index: 1000;
              }
              
              .button-container button {
                padding: 12px 30px;
                font-size: 16px;
                cursor: pointer;
                border: none;
                border-radius: 6px;
                font-weight: 600;
              }
              
              .btn-print {
                background: #2563eb;
                color: white;
              }
              
              .btn-close {
                background: #6b7280;
                color: white;
              }
              
              @media print {
                body {
                  padding: 0;
                  margin: 0;
                  display: block;
                }
                
                .button-container {
                  display: none !important;
                }
                
                .label {
                  width: 4in;
                  height: 2in;
                  border: 2px solid #000;
                  page-break-after: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="qr-side">
                <img src="${qrCodeDataURL}" alt="QR Code" style="width: 180px; height: 180px;" />
              </div>
              <div class="info-side">
                <div class="rtv-number">${rtvNumber}</div>
                <div class="customer">${formData.customerCode === "OTHER" ? formData.customCustomerName : formData.customerName}</div>
                
                <div class="item-name">${box.itemDescription}</div>
                
                <div class="detail-line">Box #${box.boxNumber}</div>
                <div class="detail-line">Net: ${box.netWeight}g | Gross: ${box.grossWeight}g</div>
                <div class="detail-line">Auth: ${formData.createdBy || 'SYSTEM'}</div>
                
                <div class="transaction">${box.transactionNo}</div>
              </div>
            </div>
            
            <div class="button-container">
              <button class="btn-print" onclick="window.print()">🖨️ Print Label</button>
              <button class="btn-close" onclick="window.close()">✕ Close</button>
            </div>
          </body>
        </html>
      `)
        printWindow.document.close()
      } else {
        toast({
          title: "❌ Print Window Blocked",
          description: "Please allow pop-ups to print QR codes",
          variant: "destructive",
        })
      }

      toast({
        title: "🖨️ QR Label Generated",
        description: `RTV QR label ready for ${box.itemDescription}`,
      })
    } catch (error) {
      toast({
        title: "❌ QR Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive",
      })
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.customerCode) {
      newErrors.customerCode = "Please select a customer"
    }

    if (formData.customerCode === "OTHER" && !formData.customCustomerName.trim()) {
      newErrors.customCustomerName = "Please enter customer name"
    }

    if (!formData.rtvType) {
      newErrors.rtvType = "Please select RTV type"
    }

    if (formData.rtvType === "other" && !formData.otherReason.trim()) {
      newErrors.otherReason = "Please specify the reason"
    }

    if (scannedBoxes.length === 0) {
      newErrors.boxes = "Please scan at least one box"
      toast({
        title: "❌ No Boxes Scanned",
        description: "Please scan at least one box to create RTV",
        variant: "destructive",
      })
    }

    // Validate each box has price
    const boxErrors = scannedBoxes.filter(
      (box) => box.price <= 0
    )
    if (boxErrors.length > 0) {
      newErrors.boxDetails = "All boxes must have price"
      toast({
        title: "❌ Incomplete Box Details",
        description: "Please fill price for all boxes",
        variant: "destructive",
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    try {
      // Calculate totals
      const totalValue = scannedBoxes.reduce((sum, box) => sum + box.price, 0)
      const totalBoxes = scannedBoxes.length

      // Prepare RTV data
      const rtvData: CreateRTVRequest = {
        customer_code: formData.customerCode,
        customer_name: formData.customerCode === "OTHER" ? formData.customCustomerName : formData.customerName,
        rtv_type: formData.rtvType as string,
        other_reason: formData.rtvType === "other" ? formData.otherReason : null,
        rtv_date: formData.rtvDate,
        invoice_number: formData.invoiceNumber,
        dc_number: formData.dcNumber,
        notes: formData.notes,
        created_by: formData.createdBy,
        items: scannedBoxes.map((box) => ({
          transaction_no: box.transactionNo,
          box_number: box.boxNumber,
          sub_category: box.subCategory,
          item_description: box.itemDescription,
          net_weight: box.netWeight,
          gross_weight: box.grossWeight,
          price: box.price,
          reason: box.reason,
          qr_data: box.qrData, // Include QR data as required by backend
        })),
      }

      console.log("📤 ===== RTV FORM SUBMISSION STARTED =====")
      console.log("📋 Company:", company)
      console.log("📋 RTV Number:", rtvNumber)
      console.log("📋 Form Data:", {
        customerCode: formData.customerCode,
        customerName: formData.customerCode === "OTHER" ? formData.customCustomerName : formData.customerName,
        rtvType: formData.rtvType,
        rtvDate: formData.rtvDate,
        invoiceNumber: formData.invoiceNumber,
        dcNumber: formData.dcNumber,
        notes: formData.notes,
        createdBy: formData.createdBy,
      })
      console.log("📦 Scanned Boxes Count:", scannedBoxes.length)
      console.log("📦 Scanned Boxes Details:", scannedBoxes.map(box => ({
        id: box.id,
        transactionNo: box.transactionNo,
        boxNumber: box.boxNumber,
        itemDescription: box.itemDescription,
        netWeight: box.netWeight,
        grossWeight: box.grossWeight,
        price: box.price,
      })))
      console.log("💰 Total Value:", totalValue)
      console.log("📤 Complete RTV Data being sent:", JSON.stringify(rtvData, null, 2))
      
      // Submit to backend
      setIsSubmitting(true)
      try {
        console.log("🌐 Calling rtvApi.createRTV...")
        const response = await rtvApi.createRTV(company, rtvData)
        console.log('📥 ===== RTV CREATION SUCCESSFUL =====')
        console.log('📥 Full API Response:', JSON.stringify(response, null, 2))
        console.log('✅ Response success:', response?.success)
        console.log('✅ Response rtv_number:', response?.rtv_number)
        console.log('✅ Response message:', response?.message)

        const createdRtvNumber = (response && (response as any).rtv_number) || rtvNumber
        console.log('✅ Created RTV Number (final):', createdRtvNumber)

        toast({
          title: '✅ RTV Created Successfully',
          description: `RTV ${createdRtvNumber} has been created with ${scannedBoxes.length} items`,
        })

        // Clear localStorage and in-memory scanned boxes
        console.log('🧹 Cleaning up after successful submission...')
        console.log('🧹 Clearing scanned boxes from state:', scannedBoxes.length, 'boxes')
        setScannedBoxes([])
        localStorage.removeItem('rtv_scanned_boxes')
        localStorage.removeItem('rtv_box_counter')
        localStorage.removeItem('rtv_form_data')
        console.log('🗑️ Cleared RTV data from localStorage')
        console.log('✅ Cleanup complete')

        // Redirect to RTV list (the list will now be loaded from backend instead of mock data)
        console.log('🔄 Redirecting to RTV list page:', `/${company}/reordering`)
        router.push(`/${company}/reordering`)
        console.log('📤 ===== RTV FORM SUBMISSION COMPLETED =====')

      } finally {
        console.log('🔓 Submission complete, unlocking form (isSubmitting = false)')
        setIsSubmitting(false)
      }
    } catch (error: any) {
      console.error("❌ ===== RTV FORM SUBMISSION FAILED =====")
      console.error("💥 Error Type:", error?.constructor?.name)
      console.error("💥 Error Message:", error?.message)
      console.error("💥 Error Stack:", error?.stack)
      console.error("💥 Full Error Object:", error)
      if (error?.response) {
        console.error("🌐 API Response Data:", error.response.data)
        console.error("🌐 API Response Status:", error.response.status)
      }
      console.error("❌ ===== END ERROR DETAILS =====")
      
      toast({
        title: "❌ Failed to Create RTV",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
    }
  }

  // Calculate totals
  const totalBoxes = scannedBoxes.length
  const totalWeight = scannedBoxes.reduce((sum, box) => sum + box.netWeight, 0)
  const totalValue = scannedBoxes.reduce((sum, box) => sum + box.price, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${company}/reordering`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <RotateCcw className="h-6 w-6" />
              Create RTV
            </h1>
            <p className="text-muted-foreground mt-1">
              Return to Vendor - {company.toUpperCase()}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {rtvNumber}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Content - Full Width */}
        <div className="space-y-6">
          {/* Basic Details */}
          <Card>
            <CardHeader>
              <CardTitle>RTV Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Selection */}
                <div className="space-y-2">
                  <Label htmlFor="customer">
                    Customer <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    value={formData.customerCode}
                    onValueChange={handleCustomerChange}
                    placeholder={isLoadingCustomers ? "Loading customers..." : "Select customer..."}
                    searchPlaceholder="Search customer..."
                    options={customers}
                    loading={isLoadingCustomers}
                    className={errors.customerCode ? "border-red-500" : ""}
                  />
                  {errors.customerCode && (
                    <p className="text-xs text-red-500">{errors.customerCode}</p>
                  )}
                </div>

                {/* Custom Customer Name - Conditional */}
                {formData.customerCode === "OTHER" && (
                  <div className="space-y-2">
                    <Label htmlFor="customCustomerName">
                      Customer Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customCustomerName"
                      value={formData.customCustomerName}
                      onChange={(e) => {
                        const value = e.target.value
                        // Only allow letters, spaces, dots, and basic punctuation
                        if (value === '' || /^[a-zA-Z\s.,'&-]+$/.test(value)) {
                          setFormData((prev) => ({
                            ...prev,
                            customCustomerName: value,
                          }))
                        }
                      }}
                      placeholder="Enter customer name..."
                      maxLength={100}
                      className={errors.customCustomerName ? "border-red-500" : ""}
                    />
                    {errors.customCustomerName && (
                      <p className="text-xs text-red-500">{errors.customCustomerName}</p>
                    )}
                  </div>
                )}

                {/* RTV Type */}
                <div className="space-y-2">
                  <Label htmlFor="rtvType">
                    RTV Reason <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.rtvType}
                    onValueChange={handleRTVTypeChange}
                  >
                    <SelectTrigger className={errors.rtvType ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select RTV type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RTV_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {type.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.rtvType && (
                    <p className="text-xs text-red-500">{errors.rtvType}</p>
                  )}
                </div>

                {/* Other Reason - Conditional */}
                {formData.rtvType === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="otherReason">
                      Please Specify <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="otherReason"
                      value={formData.otherReason}
                      onChange={(e) => {
                        const value = e.target.value
                        // Allow alphanumeric, spaces, and common punctuation
                        if (value === '' || /^[a-zA-Z0-9\s.,;:'"()&-]+$/.test(value)) {
                          setFormData((prev) => ({
                            ...prev,
                            otherReason: value,
                          }))
                        }
                      }}
                      placeholder="Enter specific reason..."
                      maxLength={200}
                      className={errors.otherReason ? "border-red-500" : ""}
                    />
                    {errors.otherReason && (
                      <p className="text-xs text-red-500">{errors.otherReason}</p>
                    )}
                  </div>
                )}

                {/* RTV Date */}
                <div className="space-y-2">
                  <Label htmlFor="rtvDate">RTV Date</Label>
                  <Input
                    id="rtvDate"
                    type="date"
                    value={formData.rtvDate}
                    readOnly
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                {/* Invoice Number */}
                <div className="space-y-2">
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow alphanumeric, dashes, slashes (common in invoice numbers)
                      if (value === '' || /^[a-zA-Z0-9/-]+$/.test(value)) {
                        setFormData((prev) => ({
                          ...prev,
                          invoiceNumber: value,
                        }))
                      }
                    }}
                    placeholder="Enter invoice number..."
                    maxLength={50}
                  />
                </div>

                {/* DC Number */}
                {/* <div className="space-y-2">
                  <Label htmlFor="dcNumber">DC Number</Label>
                  <Input
                    id="dcNumber"
                    value={formData.dcNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dcNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter DC number..."
                  />
                </div> */}
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label htmlFor="notes">Remarks</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => {
                    const value = e.target.value
                    // Allow text with common punctuation for remarks
                    if (value === '' || /^[a-zA-Z0-9\s.,;:'"()&!?@#%+=*\-/\n]+$/.test(value)) {
                      setFormData((prev) => ({
                        ...prev,
                        notes: value,
                      }))
                    }
                  }}
                  placeholder="Enter any additional remarks..."
                  rows={3}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          {/* QR Scanner Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scan Boxes</CardTitle>
                <Badge variant="secondary">{totalBoxes} boxes scanned</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showScanner ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center">
                    <Camera className="h-16 w-16 text-blue-600" />
                  </div>
                  <p className="text-center text-muted-foreground">
                    Scan QR codes from boxes to add them to RTV
                  </p>
                  <Button
                    onClick={() => setShowScanner(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Start Scanning
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <HighPerformanceQRScanner
                    onScanSuccess={handleQRScanSuccess}
                    onClose={() => setShowScanner(false)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowScanner(false)}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Close Scanner
                  </Button>
                </div>
              )}

              {errors.boxes && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {errors.boxes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanned Boxes List - Excel Style Table */}
          {scannedBoxes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Scanned Boxes ({totalBoxes})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all scanned boxes?')) {
                        setScannedBoxes([])
                        boxIdCounterRef.current = 1
                        localStorage.removeItem('rtv_scanned_boxes')
                        localStorage.removeItem('rtv_box_counter')
                        toast({
                          title: "🗑️ All Boxes Cleared",
                          description: "All scanned boxes have been removed",
                        })
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[1200px]">
                    <thead className="bg-gradient-to-r from-blue-50 to-blue-100 sticky top-0 z-10">
                      <tr>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[80px]">
                          Box #
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[180px]">
                          CONS/TR No.
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[150px]">
                          Sub Category
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[200px]">
                          Item Description
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[140px]">
                          Net Weight (g)
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[140px]">
                          Gross Weight (g)
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[120px]">
                          Price (₹) <span className="text-red-500">*</span>
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[100px]">
                          Print QR
                        </th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[100px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedBoxes.map((box, index) => (
                        <tr 
                          key={box.id} 
                          className={`${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-blue-50 transition-colors`}
                        >
                          <td className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-800">
                            {box.boxNumber}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700">
                            {box.transactionNo}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-700 text-sm">
                            {box.subCategory || "-"}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-700 text-sm font-medium">
                            {box.itemDescription}
                          </td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Input
                              type="number"
                              value={box.netWeight}
                              onChange={(e) =>
                                updateBox(box.id, "netWeight", parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-right font-mono text-sm px-2 py-1 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Input
                              type="number"
                              value={box.grossWeight}
                              onChange={(e) =>
                                updateBox(box.id, "grossWeight", parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-right font-mono text-sm px-2 py-1 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Input
                              type="number"
                              value={box.price || ""}
                              onChange={(e) =>
                                updateBox(box.id, "price", parseFloat(e.target.value) || 0)
                              }
                              placeholder="0.00"
                              className={`w-full text-right font-mono text-sm px-2 py-1 rounded ${
                                box.price <= 0 && errors.boxDetails
                                  ? "border-red-500 focus:ring-red-200"
                                  : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              }`}
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintRTVQR(box)}
                              className="hover:bg-blue-50 hover:border-blue-400 transition-all group"
                              title="Print RTV QR Code"
                            >
                              <Printer className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                            </Button>
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBox(box.id)}
                              className="hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gradient-to-r from-green-50 to-green-100 sticky bottom-0">
                      <tr className="font-bold">
                        <td colSpan={4} className="border border-gray-300 px-4 py-3 text-right text-gray-700">
                          <span className="text-lg">TOTAL:</span>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-mono text-gray-800">
                          {totalWeight.toFixed(2)} g
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-green-700 font-mono text-lg">
                          ₹{totalValue.toLocaleString()}
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* RTV Summary - Moved to Bottom */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>RTV Summary</span>
                {scannedBoxes.length > 0 && (
                  <Badge variant="secondary" className="animate-pulse">
                    Live Updates
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-blue-50 transition-all hover:scale-105">
                  <span className="text-muted-foreground text-sm">RTV Number</span>
                  <span className="font-bold text-lg mt-1">{rtvNumber}</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-white-50 transition-all hover:scale-105">
                  <span className="text-muted-foreground text-sm">Customer</span>
                  <span className="font-bold text-lg mt-1 text-center">
                    {formData.customerCode === "OTHER" ? formData.customCustomerName || "-" : formData.customerName || "-"}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-gray-50 transition-all hover:scale-105">
                  <span className="text-muted-foreground text-sm">RTV Type</span>
                  <span className="font-bold text-lg mt-1 text-center">
                    {RTV_TYPES.find((t) => t.value === formData.rtvType)?.label || "-"}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-green-50 transition-all hover:scale-105">
                  <span className="text-muted-foreground text-sm flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    Total Boxes
                  </span>
                  <span className="font-bold text-2xl mt-1 transition-all">
                    {totalBoxes}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="flex justify-between items-center p-4 border rounded-lg transition-all hover:shadow-md">
                  <span className="text-muted-foreground">Total Weight:</span>
                  <span className="font-bold text-xl font-mono">
                    {totalWeight.toFixed(2)} g
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg bg-green-50 transition-all hover:shadow-md">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-bold text-xl text-green-600 font-mono">
                    ₹{totalValue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700"
                  size="lg"
                  disabled={scannedBoxes.length === 0}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Create RTV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${company}/reordering`)}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>

              {/* Status Indicators */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg">
                    <span className="text-xs text-muted-foreground mb-2">Customer</span>
                    {formData.customerCode ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg">
                    <span className="text-xs text-muted-foreground mb-2">RTV Type</span>
                    {formData.rtvType ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg">
                    <span className="text-xs text-muted-foreground mb-2">Boxes Scanned</span>
                    {scannedBoxes.length > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg">
                    <span className="text-xs text-muted-foreground mb-2">All Prices Filled</span>
                    {scannedBoxes.every((box) => box.price > 0) &&
                    scannedBoxes.length > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
