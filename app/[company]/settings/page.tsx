"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Construction, Calendar, Wrench } from "lucide-react"
import { PermissionGuard } from "@/components/auth/permission-gate"

interface SettingsPageProps {
  params: {
    company: string
  }
}

export default function SettingsPage({ params }: SettingsPageProps) {
  return (
    <PermissionGuard module="settings" action="view">
      <div className="container mx-auto p-3 sm:p-4 lg:p-6">
        <Card className="max-w-sm sm:max-w-2xl lg:max-w-4xl mx-auto">
          <CardHeader className="text-center p-4 sm:p-6">
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <Construction className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl sm:text-2xl lg:text-3xl">System Settings</CardTitle>
            <CardDescription className="text-sm sm:text-base lg:text-lg">Configure system preferences and user management</CardDescription>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-3 sm:mt-4">
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs sm:text-sm">
                UNDER DEVELOPMENT
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 text-xs sm:text-sm">
                <Calendar className="h-3 w-3" />
                Coming Soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="text-center">
              <Wrench className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Module Under Construction</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                This module is currently being developed. It will include system settings, 
                user management, and configuration options.
              </p>
            </div>

            <div className="bg-muted/50 p-3 sm:p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-sm sm:text-base">Development Status</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                The Settings module is being built to provide comprehensive system 
                configuration and user management capabilities.
              </p>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" disabled size="sm" className="text-xs sm:text-sm">
                Under Development
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
