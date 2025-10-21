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
      <CardHeader>
        <CardTitle>Boxes / UOM Table</CardTitle>
        <CardDescription>Manage multiple articles or UOMs. Box totals must match batch totals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validation Status */}
        {boxes && boxes.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">Totals Validation</p>
              <div className="flex items-center space-x-4 text-xs">
                <span className={netWeightMatch ? "text-green-600" : "text-red-600"}>
                  Net: {boxNetTotal.toFixed(2)} / {headerTotals.netWeight?.toFixed(2) || "0.00"}
                </span>
                <span className={totalWeightMatch ? "text-green-600" : "text-red-600"}>
                  Gross: {boxGrossTotal.toFixed(2)} / {headerTotals.totalWeight?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
            <Badge variant={totalsMatch ? "default" : "destructive"}>{totalsMatch ? "Valid" : "Mismatch"}</Badge>
          </div>
        )}

        {/* Existing Boxes Table */}
        {boxes && boxes.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Box #</TableHead>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Net Wt</TableHead>
                  <TableHead>Gross Wt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boxes.map((box: BoxData, index: number) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        type="number"
                        value={box.box_number}
                        onChange={(e) => updateBox(index, "box_number", Number.parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={box.lot_number || ""}
                        onChange={(e) => updateBox(index, "lot_number", e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={box.article || ""}
                        onChange={(e) => updateBox(index, "article", e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={box.net_weight || ""}
                        onChange={(e) => updateBox(index, "net_weight", Number.parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={box.gross_weight || ""}
                        onChange={(e) => updateBox(index, "gross_weight", Number.parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeBox(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add New Box */}
        <div className="border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Add New Box</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="new-box-number">Box #</Label>
              <Input
                id="new-box-number"
                type="number"
                value={newBox.box_number || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, box_number: Number.parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label htmlFor="new-lot-number">Lot #</Label>
              <Input
                id="new-lot-number"
                value={newBox.lot_number || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, lot_number: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-article">Article</Label>
              <Input
                id="new-article"
                value={newBox.article || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, article: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-net-weight">Net Wt</Label>
              <Input
                id="new-net-weight"
                type="number"
                step="0.01"
                value={newBox.net_weight || ""}
                onChange={(e) => setNewBox((prev) => ({ ...prev, net_weight: Number.parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label htmlFor="new-gross-weight">Gross Wt</Label>
              <Input
                id="new-gross-weight"
                type="number"
                step="0.01"
                value={newBox.gross_weight || ""}
                onChange={(e) =>
                  setNewBox((prev) => ({ ...prev, gross_weight: Number.parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <Button type="button" onClick={addBox} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Box
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
