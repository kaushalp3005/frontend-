"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

interface BreadcrumbsProps {
  company: string
}

export function Breadcrumbs({ company }: BreadcrumbsProps) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const pathSegments = segments.slice(1)

  const breadcrumbs = [
    { label: company, href: `/${company}/dashboard`, isHome: true },
    ...pathSegments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 2).join("/")}`
      const label = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
      return { label, href, isHome: false }
    }),
  ].filter((breadcrumb, index, array) => {
    return array.findIndex(b => b.href === breadcrumb.href) === index
  })

  if (breadcrumbs.length <= 1) return null

  return (
    <nav className="flex items-center text-sm text-muted-foreground px-3 sm:px-4 lg:px-6 py-2.5 border-b bg-muted/30 overflow-x-auto">
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={`${index}-${breadcrumb.href}`} className="flex items-center whitespace-nowrap">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 mx-1.5 opacity-40" />}
          {breadcrumb.isHome ? (
            <Link href={breadcrumb.href} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{breadcrumb.label}</span>
            </Link>
          ) : index === breadcrumbs.length - 1 ? (
            <span className="text-foreground font-medium">{breadcrumb.label}</span>
          ) : (
            <Link href={breadcrumb.href} className="hover:text-foreground transition-colors">
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
