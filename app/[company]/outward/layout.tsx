import type React from "react"

interface OutwardLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function OutwardLayout({ children, params }: OutwardLayoutProps) {
  return <>{children}</>
}
