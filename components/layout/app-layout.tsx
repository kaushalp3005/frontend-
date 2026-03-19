"use client"

import React, { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { Breadcrumbs } from "./breadcrumbs"
import { cn } from "@/lib/utils"
import type { Company, Module } from "@/types/auth"

interface AppLayoutProps {
  children: React.ReactNode
  company: Company
  module?: Module
  action?: "view" | "edit" | "approve"
}

export function AppLayout({ children, company, module, action = "view" }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar-collapsed')
      if (stored !== null) {
        setSidebarCollapsed(stored === 'true')
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        company={company}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "pl-[60px]" : "pl-60 lg:pl-64 xl:pl-72"
        )}
      >
        <Header company={company} />
        <Breadcrumbs company={company} />
        <main className="flex-1 min-h-[calc(100vh-7rem)]">{children}</main>
      </div>
    </div>
  )
}
