import type React from "react"

interface InwardLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function InwardLayout({ children, params }: InwardLayoutProps) {
  return <>{children}</>
}
