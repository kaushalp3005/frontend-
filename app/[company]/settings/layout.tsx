import type React from "react"

interface SettingsLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

export default function SettingsLayout({ children, params }: SettingsLayoutProps) {
  return <>{children}</>
}
