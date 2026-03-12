"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import type { InwardFormData, BoxData } from "@/lib/validations/inwardForm"

interface BoxesTableProps {
  boxes: BoxData[]
  onBoxesChange: (boxes: BoxData[]) => void
  headerTotals: {
    netWeight?: number
    totalWeight?: number
    quantity?: number
  }
}

export function BoxesTable({ boxes = [], onBoxesChange, headerTotals }: BoxesTableProps) {
  const [newBox, setNewBox] = useState<Partial<BoxData>>({
    box_number: (boxes?.length || 0) + 1,
    net_weight: 0,
    gross_weight: 0,
    article: "",
  })

  const addBox = () => {
    if (!newBox.box_number) return

    const boxToAdd: BoxData = {
      id: `box-${Date.now()}-${Math.random()}`,
      box_number: newBox.box_number,
      lot_number: newBox.lot_number || "",
      article: newBox.article || "",
      net_weight: newBox.net_weight || 0,
      gross_weight: newBox.gross_weight || 0,
    }

    const updatedBoxes = [...(boxes || []), boxToAdd]
    onBoxesChange(updatedBoxes)

    setNewBox({
      box_number: updatedBoxes.length + 1,
    })
  }

  const removeBox = (index: number) => {
    const updatedBoxes = boxes?.filter((_: BoxData, i: number) => i !== index) || []
    onBoxesChange(updatedBoxes)
  }

  const updateBox = (index: number, field: keyof BoxData, value: string | number) => {
    if (!boxes) return

    const updatedBoxes = boxes.map((box: BoxData, i: number) => (i === index ? { ...box, [field]: value } : box))
    onBoxesChange(updatedBoxes)
  }

  // Calculate totals
  const boxNetTotal = boxes?.reduce((sum: number, box: BoxData) => sum + (box.net_weight || 0), 0) || 0
  const boxGrossTotal = boxes?.reduce((sum: number, box: BoxData) => sum + (box.gross_weight || 0), 0) || 0

  // Check if totals match
  const netWeightMatch = !headerTotals.netWeight || Math.abs(boxNetTotal - headerTotals.netWeight) < 0.01
  const totalWeightMatch = !headerTotals.totalWeight || Math.abs(boxGrossTotal - headerTotals.totalWeight) < 0.01
  const totalsMatch = netWeightMatch && totalWeightMatch

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Boxes / UOM Table</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Manage multiple articles or UOMs. Box totals must match batch totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Validation Status */}
        {boxes && boxes.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 sm:p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium">Totals Validation</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
                <span className={netWeightMatch ? "text-green-600" : "text-red-600"}>
                  Net: {boxNetTotal.toFixed(2)} / {headerTotals.netWeight?.toFixed(2) || "0.00"}
                </span>
                <span className={totalWeightMatch ? "text-green-600" : "text-red-600"}>
                  Gross: {boxGrossTotal.toFixed(2)} / {headerTotals.totalWeight?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
            <Badge variant={totalsMatch ? "default" : "destructive"} className="w-fit flex-shrink-0">{totalsMatch ? "Valid" : "Mismatch"}</Badge>
          </div>
        )}

        {/* Existing Boxes — Desktop Table */}
        {boxes && boxes.length > 0 && (
          <div className="hidden sm:block border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Box #</TableHead>
                  <TableHead className="text-xs">Lot #</TableHead>
                  <TableHead className="text-xs">Article</TableHead>
                  <TableHead className="text-xs">Net Wt</TableHead>
                  <TableHead className="text-xs">Gross Wt</TableHead>
                  <TableHead className="text-xs w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map((box: BoxData, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        value={box.box_number}
                        onChange={(e) => updateBox(index, "box_number", Number.parseInt(e.target.value) || 0)}
                        className="h-8 min-w-[60px]"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        value={box.lot_number || ""}
                        onChange={(e) => updateBox(index, "lot_number", e.target.value)}
                        className="h-8 min-w-[80px]"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        value={box.article || ""}
                        onChange={(e) => updateBox(index, "article", e.target.value)}
                        className="h-8 min-w-[100px]"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={box.net_weight || ""}
                        onChange={(e) => updateBox(index, "net_weight", Number.parseFloat(e.target.value) || 0)}
                        className="h-8 min-w-[80px]"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={box.gross_weight || ""}
                        onChange={(e) => updateBox(index, "gross_weight", Number.parseFloat(e.target.value) || 0)}
                        className="h-8 min-w-[80px]"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBox(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Existing Boxes — Mobile Cards */}
        {boxes && boxes.length > 0 && (
          <div className="sm:hidden space-y-2">
            {boxes.map((box: BoxData, index: number) => (
              <div key={index} className="border rounded-lg p-2.5 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Box #{box.box_number}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBox(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Box #</Label>
                    <Input
                      type="number"
                      value={box.box_number}
                      onChange={(e) => updateBox(index, "box_number", Number.parseInt(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Lot #</Label>
                    <Input
                      value={box.lot_number || ""}
                      onChange={(e) => updateBox(index, "lot_number", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Article</Label>
                    <Input
                      value={box.article || ""}
                      onChange={(e) => updateBox(index, "article", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Net Wt</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={box.net_weight || ""}
                      onChange={(e) => updateBox(index, "net_weight", Number.parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">Gross Wt</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={box.gross_weight || ""}
                      onChange={(e) => updateBox(index, "gross_weight", Number.parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Box */}
        <div className="border rounded-lg p-3 sm:p-4 space-y-3">
          <h4 className="text-sm font-medium">Add New Box</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="new-box-number" className="text-[10px] sm:text-xs">Box #</Label>
              <Input
                id="new-box-number"
                type="number"
                value={newBox.box_number || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, box_number: Number.parseInt(e.target.value) || 0 }))}
                className="h-8 sm:h-9"
              />
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="new-lot-number" className="text-[10px] sm:text-xs">Lot #</Label>
              <Input
                id="new-lot-number"
                value={newBox.lot_number || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, lot_number: e.target.value }))}
                className="h-8 sm:h-9"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-0.5 sm:space-y-1">
              <Label htmlFor="new-article" className="text-[10px] sm:text-xs">Article</Label>
              <Input
                id="new-article"
                value={newBox.article || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, article: e.target.value }))}
                className="h-8 sm:h-9"
              />
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="new-net-weight" className="text-[10px] sm:text-xs">Net Wt</Label>
              <Input
                id="new-net-weight"
                type="number"
                step="0.01"
                value={newBox.net_weight || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, net_weight: Number.parseFloat(e.target.value) || 0 }))}
                className="h-8 sm:h-9"
              />
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <Label htmlFor="new-gross-weight" className="text-[10px] sm:text-xs">Gross Wt</Label>
              <Input
                id="new-gross-weight"
                type="number"
                step="0.01"
                value={newBox.gross_weight || ""}
                onChange={(e) =>
                  setNewBox((prev) => ({ ...prev, gross_weight: Number.parseFloat(e.target.value) || 0 }))
                }
                className="h-8 sm:h-9"
              />
            </div>
          </div>
          <Button type="button" onClick={addBox} size="sm" className="w-full gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Box
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
