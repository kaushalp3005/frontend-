import type React from "react"

interface ReportsLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function ReportsLayout({ children, params }: ReportsLayoutProps) {
  return <>{children}</>
}
