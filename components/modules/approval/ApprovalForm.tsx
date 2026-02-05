"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { createApproval, getApprovalByConsignment, updateApproval } from "@/lib/api/approvalApiService"
import type { OutwardListItem } from "@/types/outward"
import type { ApprovalDetailResponse } from "@/types/approval"

interface ApprovalFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: string
  outwardRecord: OutwardListItem
  onSuccess?: () => void
}

export default function ApprovalForm({ 
  open, 
  onOpenChange, 
  company, 
  outwardRecord,
  onSuccess 
}: ApprovalFormProps) {
  const [loading, setLoading] = useState(false)
  const [existingApproval, setExistingApproval] = useState<ApprovalDetailResponse | null>(null)
  const [formData, setFormData] = useState({
    approval_authority: "",
    approval_date: new Date().toISOString().split('T')[0],
    quantity: outwardRecord.boxes || 0,
    uom: "KG",
    gross_weight: parseFloat(outwardRecord.gross_weight) || 0,
    net_weight: parseFloat(outwardRecord.net_weight) || 0,
    approval_status: true,
    remark: ""
  })

  // Check if approval already exists for this consignment
  useEffect(() => {
    if (open && outwardRecord.consignment_no) {
      checkExistingApproval()
    }
  }, [open, outwardRecord.consignment_no])

  const checkExistingApproval = async () => {
    try {
      const response = await getApprovalByConsignment(company, outwardRecord.consignment_no)
      if (response.approval) {
        setExistingApproval(response.approval)
        setFormData({
          approval_authority: response.approval.approval_authority,
          approval_date: response.approval.approval_date,
          quantity: response.approval.quantity,
          uom: response.approval.uom,
          gross_weight: response.approval.gross_weight,
          net_weight: response.approval.net_weight,
          approval_status: response.approval.approval_status,
          remark: response.approval.remark
        })
      }
    } catch (err) {
      // No existing approval found, that's okay
      setExistingApproval(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.approval_authority.trim()) {
      toast({
        title: "Validation Error",
        description: "Approval authority is required",
        variant: "destructive"
      })
      return
    }

    if (formData.quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Quantity must be greater than 0",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        consignment_no: outwardRecord.consignment_no,
        approval_authority: formData.approval_authority.toUpperCase(),
        approval_date: formData.approval_date,
        quantity: formData.quantity,
        uom: formData.uom.toUpperCase(),
        gross_weight: formData.gross_weight,
        net_weight: formData.net_weight,
        approval_status: formData.approval_status,
        remark: formData.remark.toUpperCase()
      }

      if (existingApproval) {
        // Update existing approval
        await updateApproval(company, existingApproval.id, payload)
        toast({
          title: "Approval Updated",
          description: `Approval for ${outwardRecord.consignment_no} has been updated successfully.`
        })
      } else {
        // Create new approval
        await createApproval(company, payload)
        toast({
          title: "Approval Created",
          description: `Approval for ${outwardRecord.consignment_no} has been created successfully.`
        })
      }

      onOpenChange(false)
      
      // Small delay to ensure backend has processed the approval
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error("Error submitting approval:", err)
      toast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Failed to submit approval",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = () => {
    setFormData(prev => ({ ...prev, approval_status: true }))
  }

  const handleReject = () => {
    setFormData(prev => ({ ...prev, approval_status: false }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingApproval ? "Update Approval" : "Create Approval"}
          </DialogTitle>
          <DialogDescription>
            {existingApproval 
              ? `Update approval details for consignment ${outwardRecord.consignment_no}`
              : `Approve or reject consignment ${outwardRecord.consignment_no}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Consignment Details */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Consignment Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Consignment No:</span>
                <span className="ml-2 font-medium">{outwardRecord.consignment_no}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <span className="ml-2 font-medium">{outwardRecord.customer_name}</span>
              </div>
            </div>
          </div>

          {/* Approval Status Toggle */}
          <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
            <Button
              type="button"
              onClick={handleReject}
              variant={!formData.approval_status ? "destructive" : "outline"}
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              type="button"
              onClick={handleApprove}
              variant={formData.approval_status ? "default" : "outline"}
              className={formData.approval_status ? "bg-green-600 hover:bg-green-700 flex-1" : "flex-1"}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Approval Authority */}
            <div className="space-y-2">
              <Label htmlFor="approval_authority">
                Approval Authority <span className="text-red-500">*</span>
              </Label>
              <Input
                id="approval_authority"
                value={formData.approval_authority}
                onChange={(e) => setFormData(prev => ({ ...prev, approval_authority: e.target.value }))}
                placeholder="Enter approval authority name"
                required
              />
            </div>

            {/* Approval Date */}
            <div className="space-y-2">
              <Label htmlFor="approval_date">
                Approval Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="approval_date"
                type="date"
                value={formData.approval_date}
                onChange={(e) => setFormData(prev => ({ ...prev, approval_date: e.target.value }))}
                required
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                placeholder="Enter quantity"
                min="1"
                required
              />
            </div>

            {/* UOM */}
            <div className="space-y-2">
              <Label htmlFor="uom">
                Unit of Measurement <span className="text-red-500">*</span>
              </Label>
              <Input
                id="uom"
                value={formData.uom}
                onChange={(e) => setFormData(prev => ({ ...prev, uom: e.target.value }))}
                placeholder="e.g., KG, PCS, LTR"
                required
              />
            </div>

            {/* Gross Weight */}
            <div className="space-y-2">
              <Label htmlFor="gross_weight">
                Gross Weight <span className="text-red-500">*</span>
              </Label>
              <Input
                id="gross_weight"
                type="number"
                step="0.01"
                value={formData.gross_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, gross_weight: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter gross weight"
                min="0"
                required
              />
            </div>

            {/* Net Weight */}
            <div className="space-y-2">
              <Label htmlFor="net_weight">
                Net Weight <span className="text-red-500">*</span>
              </Label>
              <Input
                id="net_weight"
                type="number"
                step="0.01"
                value={formData.net_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, net_weight: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter net weight"
                min="0"
                required
              />
            </div>
          </div>

          {/* Remark */}
          <div className="space-y-2">
            <Label htmlFor="remark">Remark</Label>
            <Textarea
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
              placeholder="Enter any remarks or comments"
              rows={4}
            />
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={formData.approval_status ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {formData.approval_status ? (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  {existingApproval ? "Update" : "Submit"} {formData.approval_status ? "Approval" : "Rejection"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
