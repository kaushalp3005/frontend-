"use client"

import { useState } from "react"
import { PermissionGuard } from "@/components/auth/permission-gate"
import OutwardForm from "@/components/modules/outward/OutwardForm"
import OutwardList from "@/components/modules/outward/OutwardList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, List } from "lucide-react"
import { createOutward } from "@/lib/api/outwardApiService"
import { toast } from "@/hooks/use-toast"
import type { OutwardFormData } from "@/types/outward"
import type { Company } from "@/lib/api"

interface OutwardPageProps {
  params: {
    company: string
  }
}

export default function OutwardPage({ params }: OutwardPageProps) {
  const company = params.company as Company
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState("list")
  
  const handleCreateOutward = async (data: OutwardFormData) => {
    try {
      await createOutward(company, data)
      toast({
        title: "Outward record created",
        description: `Consignment ${data.consignment_no} has been created successfully`
      })
      setRefreshTrigger(prev => prev + 1)
      setActiveTab("list") // Switch to list view after creation
    } catch (error) {
      throw error // Let the form handle the error
    }
  }

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }
  
  return (
    <PermissionGuard module="outward" action="view">
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6 w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Outward Management - {company.toUpperCase()}
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage outward shipments with auto-generated consignment numbers
          </p>
        </div>

        {/* Tabs for Create and List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Records</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create New</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <OutwardList company={company} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <OutwardForm company={company} onSubmit={handleCreateOutward} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
