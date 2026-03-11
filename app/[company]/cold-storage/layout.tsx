import type React from "react"

interface ColdStorageLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function ColdStorageLayout({ children, params }: ColdStorageLayoutProps) {
  return <>{children}</>
}
