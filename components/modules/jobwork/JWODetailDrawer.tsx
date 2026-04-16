"use client"

import React from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { JobworkDetailRow } from "@/types/jobwork"

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800",
  "Partially Received": "bg-orange-100 text-orange-800",
  "Fully Received": "bg-teal-100 text-teal-800",
  Reconciled: "bg-purple-100 text-purple-800",
  Closed: "bg-green-100 text-green-800",
}

const lossColors: Record<string, string> = {
  Normal: "bg-green-100 text-green-800",
  "Excess Loss": "bg-red-100 text-red-800",
  "Underweight Waste": "bg-amber-100 text-amber-800",
  Pending: "bg-gray-100 text-gray-800",
}

interface JWODetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  jwos: JobworkDetailRow[]
  loading: boolean
}

export function JWODetailDrawer({
  open,
  onOpenChange,
  title,
  jwos,
  loading,
}: JWODetailDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="sm:max-w-2xl w-full">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jwos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No JWOs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">JWO ID</th>
                    <th className="py-2 pr-3 font-medium">Vendor</th>
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium text-right">Dispatched</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {jwos.map((jwo) => (
                    <tr key={jwo.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-3 font-mono text-xs">{jwo.jwo_id}</td>
                      <td className="py-2 pr-3">{jwo.vendor_name}</td>
                      <td className="py-2 pr-3">{jwo.item_name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{jwo.dispatch_date}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {jwo.qty_dispatched.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="secondary"
                          className={statusColors[jwo.jwo_status] || "bg-gray-100 text-gray-800"}
                        >
                          {jwo.jwo_status}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Badge
                          variant="secondary"
                          className={lossColors[jwo.loss_status] || "bg-gray-100 text-gray-800"}
                        >
                          {jwo.loss_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
