import type React from "react"

interface RTVLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function RTVLayout({ children, params }: RTVLayoutProps) {
  return <>{children}</>
}
