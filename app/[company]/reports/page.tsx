"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Construction, Calendar } from "lucide-react"
import { PermissionGuard } from "@/components/auth/permission-gate"

interface ReportsPageProps {
  params: {
    company: string
  }
}

export default function ReportsPage({ params }: ReportsPageProps) {
  return (
    <PermissionGuard module="reports" action="view">
      <div className="flex items-center justify-center min-h-[60vh] p-4 sm:p-6">
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-3">
              <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Reports & Analytics</CardTitle>
            <CardDescription className="text-sm">
              Generate comprehensive inventory and operational reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8">
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                Under Development
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                Coming Soon
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              This module will include comprehensive reporting, analytics, and data visualization capabilities.
            </p>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
