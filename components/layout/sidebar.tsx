"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuthStore } from "@/lib/stores/auth"
import type { Module } from "@/types/auth"
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowRightLeft,
  Package,
  ShoppingCart,
  RotateCcw,
  ArrowUpFromLine,
  FileText,
  Menu,
  X,
  Lock,
  Utensils,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  module: Module
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    title: "Inward",
    href: "/inward",
    icon: ArrowDownToLine,
    module: "inward",
  },
  {
    title: "Transfer",
    href: "/transfer",
    icon: ArrowRightLeft,
    module: "transfer",
  },
  {
    title: "Consumption",
    href: "/consumption",
    icon: Utensils,
    module: "consumption",
  },
  {
    title: "Inventory Ledger",
    href: "/inventory-ledger",
    icon: Package,
    module: "inventory-ledger",
  },
  {
    title: "RTV/Rejection",
    href: "/reordering",
    icon: RotateCcw,
    module: "reordering",
  },
  {
    title: "Outward",
    href: "/outward",
    icon: ArrowUpFromLine,
    module: "outward",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
    module: "reports",
  },
]

interface SidebarProps {
  company: string
}

export function Sidebar({ company }: SidebarProps) {
  // Auto-collapse on smaller screens by default
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const { user, currentCompany, hasPermission } = useAuthStore()

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed)
    // Store preference in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', (!isCollapsed).toString())
    }
  }

  // Initialize collapsed state from localStorage and screen size
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar-collapsed')
      if (stored !== null) {
        setIsCollapsed(stored === 'true')
      }
    }
  }, [])

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 sm:h-16 items-center border-b px-2 sm:px-4">
        {!isCollapsed && (
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded bg-primary flex items-center justify-center">
              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-semibold">Inventory</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">{company}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="ml-auto h-8 w-8">
          <Menu className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          <TooltipProvider>
            {navItems.map((item) => {
              const href = `/${company}${item.href}`
              const isActive = pathname === href
              const hasAccess = user && currentCompany && hasPermission && hasPermission(item.module, "view")
              const isLocked = !hasAccess

              const NavButton = (
                <Button
                  key={item.title}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-9 sm:h-10",
                    isCollapsed && "px-2",
                    isLocked && "opacity-50 cursor-not-allowed",
                  )}
                  asChild={!isLocked}
                  disabled={isLocked}
                >
                  {isLocked ? (
                    <div className="flex items-center w-full">
                      <item.icon className={cn("h-3 w-3 sm:h-4 sm:w-4", isCollapsed ? "mr-0" : "mr-2")} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-xs sm:text-sm">{item.title}</span>
                          <Lock className="h-2 w-2 sm:h-3 sm:w-3" />
                        </>
                      )}
                    </div>
                  ) : (
                    <Link href={href} className="flex items-center w-full">
                      <item.icon className={cn("h-3 w-3 sm:h-4 sm:w-4", isCollapsed ? "mr-0" : "mr-2")} />
                      {!isCollapsed && <span className="text-xs sm:text-sm">{item.title}</span>}
                    </Link>
                  )}
                </Button>
              )

              if (isLocked && isCollapsed) {
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.title} - No access, contact admin</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              if (isCollapsed) {
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return NavButton
            })}
          </TooltipProvider>
        </nav>
      </ScrollArea>
    </div>
  )

  return (
    <>
      {/* Sidebar - Visible on all resolutions */}
      <div
        className={cn(
          "flex flex-col fixed inset-y-0 z-50 bg-card border-r transition-all duration-300",
          isCollapsed ? "w-14 sm:w-16" : "w-56 sm:w-60 md:w-64 lg:w-64 xl:w-72",
        )}
      >
        <SidebarContent />
      </div>
    </>
  )
}
