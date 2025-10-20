"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, ArrowLeft, Mail } from "lucide-react"

export default function ForbiddenPage() {
  const handleRequestAccess = () => {
    // Mock request access functionality
    console.log("Access request sent")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>You don't have permission to access this resource</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Contact your administrator to request access to this module or company.
          </p>

          <div className="flex flex-col space-y-2">
            <Button onClick={handleRequestAccess} className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Request Access
            </Button>

            <Button variant="outline" asChild className="w-full bg-transparent">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
