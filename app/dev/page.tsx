import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Code,
  Database,
  Shield,
  Upload,
  QrCode,
  FileText,
  Users,
  Settings,
  BarChart3,
  Package,
  ArrowRightLeft,
} from "lucide-react"

export default function DevPage() {
  const implementedFeatures = [
    { name: "Multi-tenant Authentication", icon: Shield, status: "complete" },
    { name: "OpenFGA Authorization", icon: Users, status: "complete" },
    { name: "Responsive Dashboard", icon: BarChart3, status: "complete" },
    { name: "Inward Module", icon: Package, status: "complete" },
    { name: "Transfer Module", icon: ArrowRightLeft, status: "complete" },
    { name: "QR Code Generation", icon: QrCode, status: "complete" },
    { name: "File Upload Simulation", icon: Upload, status: "complete" },
    { name: "AI Extraction Mock", icon: Code, status: "complete" },
  ]

  const pendingFeatures = [
    { name: "Outward Module", icon: Package, priority: "high" },
    { name: "Reports Module", icon: FileText, priority: "medium" },
    { name: "Settings Module", icon: Settings, priority: "low" },
    { name: "Real Database Integration", icon: Database, priority: "high" },
    { name: "Real File Storage", icon: Upload, priority: "medium" },
    { name: "Real AI Integration", icon: Code, priority: "medium" },
  ]

  const mockServices = [
    "Authentication Service",
    "Authorization Service (OpenFGA-style)",
    "Database Service",
    "File Storage Service (S3-style)",
    "AI Extraction Service",
    "QR Code Generation Service",
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Developer Dashboard</h1>
        <p className="text-muted-foreground text-lg">Multi-tenant Inventory Management System - Development Overview</p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-green-600" />
              Implemented Features
            </CardTitle>
            <CardDescription>Core functionality that's ready for use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {implementedFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <feature.icon className="h-4 w-4 text-green-600" />
                  <span className="flex-1">{feature.name}</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Complete</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              Pending Features
            </CardTitle>
            <CardDescription>Features planned for future development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <feature.icon className="h-4 w-4 text-orange-600" />
                  <span className="flex-1">{feature.name}</span>
                  <Badge
                    variant={
                      feature.priority === "high"
                        ? "destructive"
                        : feature.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {feature.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Mock Services
          </CardTitle>
          <CardDescription>Simulated backend services for development and testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mockServices.map((service, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="h-2 w-2 bg-blue-600 rounded-full" />
                <span className="text-sm">{service}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Overview</CardTitle>
          <CardDescription>Current system architecture and technology stack</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Frontend</h4>
            <p className="text-sm text-muted-foreground">
              Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui components
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Authentication & Authorization</h4>
            <p className="text-sm text-muted-foreground">
              Mock session-based auth with OpenFGA-style relationship-based authorization
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Data Layer</h4>
            <p className="text-sm text-muted-foreground">
              In-memory mock database with realistic data structures and relationships
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">File Handling</h4>
            <p className="text-sm text-muted-foreground">
              Simulated file upload with progress tracking and AI extraction mock
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="outline" size="lg">
          View Source Code
        </Button>
      </div>
    </div>
  )
}
