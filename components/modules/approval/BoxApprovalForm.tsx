"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, CheckCircle, XCircle, Package, Info } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { 
  getBoxApprovalsByConsignment, 
  createBoxApproval, 
  updateBoxApproval
} from "@/lib/api/approvalApiService"
import type { OutwardListItem } from "@/types/outward"
import type { BoxApprovalListItem } from "@/types/approval"
import { APPROVAL_STATUS_COLORS } from "@/types/approval"

interface BoxApprovalFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: string
  outwardRecord: OutwardListItem
  onSuccess?: () => void
}

interface BoxWithApproval {
  box_number: number
  article_description: string
  net_weight: number
  gross_weight: number
  approval_status: 'approved' | 'rejected' | 'pending'
  approval_id?: number
  approval_authority?: string
  approval_date?: string
  remark?: string
}

export default function BoxApprovalForm({ 
  open, 
  onOpenChange, 
  company, 
  outwardRecord,
  onSuccess 
}: BoxApprovalFormProps) {
  const [loading, setLoading] = useState(false)
  const [boxes, setBoxes] = useState<BoxWithApproval[]>([])
  const [approvalAuthority, setApprovalAuthority] = useState("")
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().split('T')[0])
  const [remark, setRemark] = useState("")
  const [backendAvailable, setBackendAvailable] = useState(true)

  // Load boxes and their approval status
  useEffect(() => {
    if (open && outwardRecord.consignment_no) {
      loadBoxes()
    }
  }, [open, outwardRecord.consignment_no])

  const loadBoxes = async () => {
    setLoading(true)
    try {
      // Generate boxes based on total boxes count
      const mockBoxes: BoxWithApproval[] = []
      const totalBoxes = outwardRecord.boxes || 0
      
      // Try to fetch box approvals from backend
      let approvalRecords: any[] = []
      try {
        const response = await getBoxApprovalsByConsignment(company, outwardRecord.consignment_no)
        approvalRecords = response.records || []
        setBackendAvailable(true)
      } catch (err: any) {
        // Backend endpoint not available yet - continue with pending status for all boxes
        console.log("Box approval endpoint not available yet, using pending status for all boxes")
        setBackendAvailable(false)
      }
      
      for (let i = 1; i <= totalBoxes; i++) {
        const approval = approvalRecords.find(a => a.box_number === i)
        mockBoxes.push({
          box_number: i,
          article_description: `Article ${i}`, // TODO: Get actual article from backend
          net_weight: parseFloat(outwardRecord.net_weight) / totalBoxes || 0,
          gross_weight: parseFloat(outwardRecord.gross_weight) / totalBoxes || 0,
          approval_status: approval ? (approval.approval_status ? 'approved' : 'rejected') : 'pending',
          approval_id: approval?.id,
          approval_authority: approval?.approval_authority,
          approval_date: approval?.approval_date,
          remark: approval ? '' : undefined
        })
      }
      
      setBoxes(mockBoxes)
    } catch (err) {
      console.error("Error loading boxes:", err)
      toast({
        title: "Error",
        description: "Failed to load box data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleIndividualApproval = async (box: BoxWithApproval, status: boolean) => {
    if (!backendAvailable) {
      toast({
        title: "Backend Not Available",
        description: "The box approval endpoint has not been implemented yet. Please contact your backend developer.",
        variant: "destructive"
      })
      return
    }

    if (!approvalAuthority.trim()) {
      toast({
        title: "Validation Error",
        description: "Approval authority is required",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        consignment_no: outwardRecord.consignment_no,
        box_number: box.box_number,
        article_description: box.article_description,
        approval_authority: approvalAuthority.toUpperCase(),
        approval_date: approvalDate,
        net_weight: box.net_weight,
        gross_weight: box.gross_weight,
        approval_status: status,
        remark: remark.toUpperCase()
      }

      if (box.approval_id) {
        await updateBoxApproval(company, box.approval_id, payload)
      } else {
        await createBoxApproval(company, payload)
      }

      toast({
        title: "Success",
        description: `Box #${box.box_number} ${status ? 'approved' : 'rejected'} successfully`
      })

      await loadBoxes()
    } catch (err) {
      console.error("Error in individual approval:", err)
      toast({
        title: "Approval Failed",
        description: err instanceof Error ? err.message : "Failed to process approval",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: 'approved' | 'rejected' | 'pending') => {
    return APPROVAL_STATUS_COLORS[status]
  }

  const pendingBoxes = boxes.filter(b => b.approval_status === 'pending').length
  const approvedBoxes = boxes.filter(b => b.approval_status === 'approved').length
  const rejectedBoxes = boxes.filter(b => b.approval_status === 'rejected').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Box-Level Approval
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div>Consignment: <strong>{outwardRecord.consignment_no}</strong></div>
            <div>Customer: <strong>{outwardRecord.customer_name}</strong></div>
            <div>Total Boxes: <strong>{outwardRecord.boxes}</strong></div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Backend Status Alert */}
          {!backendAvailable && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Backend Not Ready:</strong> The box-approval endpoint is not yet implemented. 
                This interface is ready to use once your backend developer adds the following endpoints:
                <ul className="mt-2 ml-4 list-disc text-xs">
                  <li><code>POST /box-approval/{"{company}"}</code> - Create box approval</li>
                  <li><code>GET /box-approval/{"{company}"}/consignment/{"{consignment_no}"}</code> - Get box approvals</li>
                  <li><code>PUT /box-approval/{"{company}"}/{"{id}"}</code> - Update box approval</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-xs text-blue-700 mb-1 font-medium">Total Boxes</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{boxes.length}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-xs text-green-700 mb-1 font-medium">Approved</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900">{approvedBoxes}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
              <p className="text-xs text-red-700 mb-1 font-medium">Rejected</p>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{rejectedBoxes}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
              <p className="text-xs text-yellow-700 mb-1 font-medium">Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{pendingBoxes}</p>
            </div>
          </div>

          {/* Approval Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-muted rounded-lg">
            <div>
              <Label htmlFor="approval_authority" className="text-sm">
                Approval Authority <span className="text-red-500">*</span>
              </Label>
              <Input
                id="approval_authority"
                value={approvalAuthority}
                onChange={(e) => setApprovalAuthority(e.target.value)}
                placeholder="Enter approval authority"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="approval_date" className="text-sm">
                Approval Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="approval_date"
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="remark" className="text-sm">Remark</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Enter remarks (optional)"
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          {/* Boxes Table */}
          <div className="border rounded-lg overflow-auto">
            <div className="min-w-[800px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="w-20">Box #</TableHead>
                    <TableHead className="min-w-[200px]">Article</TableHead>
                    <TableHead className="w-28">Net Wt (gm)</TableHead>
                    <TableHead className="w-28">Gross Wt (gm)</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="min-w-[150px]">Authority</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boxes.map((box) => (
                    <TableRow key={box.box_number}>
                      <TableCell className="font-medium">{box.box_number}</TableCell>
                      <TableCell className="text-sm">{box.article_description}</TableCell>
                      <TableCell className="text-sm">{box.net_weight.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{box.gross_weight.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(box.approval_status)}>
                          {box.approval_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {box.approval_authority || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleIndividualApproval(box, true)}
                            disabled={loading || box.approval_status === 'approved'}
                            className="bg-green-50 hover:bg-green-100 border-green-200 px-2"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleIndividualApproval(box, false)}
                            disabled={loading || box.approval_status === 'rejected'}
                            className="bg-red-50 hover:bg-red-100 border-red-200 px-2"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


