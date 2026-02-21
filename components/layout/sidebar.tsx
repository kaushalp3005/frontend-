"use client"

import React from "react"
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
  RotateCcw,
  ArrowUpFromLine,
  FileText,
  Menu,
  Lock,
  Utensils,
  Settings,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  module: Module
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "Inward", href: "/inward", icon: ArrowDownToLine, module: "inward" },
  { title: "Transfer", href: "/transfer", icon: ArrowRightLeft, module: "transfer" },
  { title: "Consumption", href: "/consumption", icon: Utensils, module: "consumption" },
  { title: "Inventory", href: "/inventory-ledger", icon: Package, module: "inventory-ledger" },
  { title: "RTV/Rejection", href: "/reordering", icon: RotateCcw, module: "reordering" },
  { title: "Outward", href: "/outward", icon: ArrowUpFromLine, module: "outward" },
  { title: "Reports", href: "/reports", icon: FileText, module: "reports" },
  { title: "Settings", href: "/settings", icon: Settings, module: "settings" },
]

interface SidebarProps {
  company: string
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function Sidebar({ company, collapsed: isCollapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const { user, currentCompany, hasPermission } = useAuthStore()

  const toggleCollapsed = () => {
    const next = !isCollapsed
    onCollapsedChange(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', next.toString())
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col fixed inset-y-0 z-50 border-r bg-card transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[60px]" : "w-60 lg:w-64 xl:w-72",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b px-3">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight truncate">IMS</h2>
              <p className="text-[10px] text-muted-foreground truncate">{company}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn("h-8 w-8 flex-shrink-0", !isCollapsed && "ml-auto")}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-2 space-y-1">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const href = `/${company}${item.href}`
              const isActive = pathname === href || pathname.startsWith(href + "/")
              const hasAccess = user && currentCompany && hasPermission && hasPermission(item.module, "view")
              const isLocked = !hasAccess

              const NavButton = (
                <Button
                  key={item.title}
                  variant="ghost"
                  className={cn(
                    "w-full h-9 relative transition-colors",
                    isCollapsed ? "justify-center px-0" : "justify-start px-3",
                    isActive && "bg-primary/10 text-primary font-semibold hover:bg-primary/15",
                    !isActive && "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    isLocked && "opacity-40 cursor-not-allowed",
                  )}
                  asChild={!isLocked}
                  disabled={isLocked}
                >
                  {isLocked ? (
                    <div className="flex items-center w-full">
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "mr-2.5")} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-sm truncate">{item.title}</span>
                          <Lock className="h-3 w-3 flex-shrink-0 ml-1" />
                        </>
                      )}
                    </div>
                  ) : (
                    <Link href={href} className="flex items-center w-full">
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "mr-2.5")} />
                      {!isCollapsed && <span className="text-sm truncate">{item.title}</span>}
                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                      )}
                    </Link>
                  )}
                </Button>
              )

              if (isCollapsed) {
                return (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.title}{isLocked ? " — No access" : ""}
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
}
