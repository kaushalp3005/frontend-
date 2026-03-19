// components/modules/inward/InwardFormSidebar.tsx
"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { 
  Save, 
  RotateCcw, 
  Printer, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Package,
  Scale,
  DollarSign,
  FileText
} from "lucide-react"
import { usePrinterSelection } from "@/lib/hooks/usePrinters"
import { InwardFormUtils } from "@/lib/utils/inwardFormUtils"
import type { Company } from "@/types/inward"

interface InwardFormSidebarProps {
  // Form state
  formData: any
  articles: any[]
  boxes: any[]
  errors: Record<string, string>
  isSubmitting: boolean
  isDirty: boolean
  lastSaved: Date | null
  
  // Form actions
  onSave: () => Promise<void>
  onReset: () => void
  onPreview?: () => void
  
  // Box actions
  onPrintBox?: (box: any) => Promise<void>
  onPrintAllBoxes?: () => Promise<void>
  onPreviewBox?: (box: any) => Promise<void>
  
  // Printing state
  printingBoxes: number[]
  isPrinting: boolean
  
  // Company
  company: Company
}

export function InwardFormSidebar({
  formData,
  articles,
  boxes,
  errors,
  isSubmitting,
  isDirty,
  lastSaved,
  onSave,
  onReset,
  onPreview,
  onPrintBox,
  onPrintAllBoxes,
  onPreviewBox,
  printingBoxes,
  isPrinting,
  company
}: InwardFormSidebarProps) {
  const { selectedPrinter, availablePrinters, loading: printerLoading, selectPrinter } = usePrinterSelection()

  // Calculate form summary
  const totalAmount = articles.reduce((sum, article) => sum + article.total_amount, 0)
  const totalTax = articles.reduce((sum, article) => sum + article.tax_amount, 0)
  const totalDiscount = articles.reduce((sum, article) => sum + article.discount_amount, 0)
  const totalQuantity = articles.reduce((sum, article) => sum + article.quantity_units, 0)
  const totalNetWeight = boxes.reduce((sum, box) => sum + box.net_weight, 0)
  const totalGrossWeight = boxes.reduce((sum, box) => sum + box.gross_weight, 0)

  const hasErrors = Object.keys(errors).length > 0
  const canSave = !hasErrors && !isSubmitting && isDirty
  const canPrint = !hasErrors && !isPrinting && boxes.length > 0 && selectedPrinter

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Form Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Form Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={hasErrors ? "destructive" : isDirty ? "secondary" : "default"}>
              {hasErrors ? "Has Errors" : isDirty ? "Unsaved Changes" : "Saved"}
            </Badge>
          </div>
          
          {lastSaved && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Saved</span>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                {lastSaved.toLocaleTimeString()}
              </div>
            </div>
          )}

          {hasErrors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {Object.keys(errors).length} error(s) need to be fixed before saving.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Form Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Articles</span>
            <span className="font-medium">{articles.length}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Boxes</span>
            <span className="font-medium">{boxes.length}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Quantity</span>
            <span className="font-medium">{totalQuantity}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Net Weight</span>
            <div className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              <span className="font-medium">{totalNetWeight.toFixed(2)} kg</span>
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Gross Weight</span>
            <div className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              <span className="font-medium">{totalGrossWeight.toFixed(2)} kg</span>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tax</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">₹{totalTax.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">-₹{totalDiscount.toFixed(2)}</span>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-between">
            <span className="text-sm font-medium">Total Amount</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-bold text-lg">₹{(totalAmount + totalTax - totalDiscount).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Printer Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="printer-select">Select Printer</Label>
            <Select 
              value={selectedPrinter || ""} 
              onValueChange={selectPrinter}
              disabled={printerLoading}
            >
              <SelectTrigger id="printer-select">
                <SelectValue placeholder={printerLoading ? "Loading printers..." : "Select a printer"} />
              </SelectTrigger>
              <SelectContent>
                {availablePrinters.map((printer) => (
                  <SelectItem key={printer.name} value={printer.name}>
                    <div className="flex items-center gap-2">
                      <Printer className="h-3 w-3" />
                      <span>{printer.name}</span>
                      {printer.isDefault && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {!selectedPrinter && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a printer to enable label printing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Quick Box Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Quick Box Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {boxes.slice(0, 5).map((box) => (
              <div key={box.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium">{box.box_number}</span>
                  </div>
                  <span className="font-medium truncate">{box.article}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {box.net_weight}kg
                  </Badge>
                  {onPreviewBox && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPreviewBox(box)}
                      className="h-6 w-6 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {boxes.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                +{boxes.length - 5} more boxes
              </p>
            )}
            
            {boxes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No boxes generated yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            className="w-full" 
            onClick={onSave} 
            disabled={!canSave}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Entry"}
          </Button>
          
          <Button 
            className="w-full" 
            variant="outline" 
            onClick={onReset}
            disabled={isSubmitting}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear Form
          </Button>
          
          {onPreview && (
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={onPreview}
              disabled={hasErrors}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          )}
          
          {onPrintAllBoxes && (
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={onPrintAllBoxes}
              disabled={!canPrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              {isPrinting ? "Printing..." : `Print All (${boxes.length})`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Printing Status */}
      {isPrinting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Printing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Printing Boxes</span>
                <Badge variant="secondary">
                  {printingBoxes.length} of {boxes.length}
                </Badge>
              </div>
              
              <div className="space-y-1">
                {printingBoxes.map((boxNumber) => (
                  <div key={boxNumber} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Box {boxNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
