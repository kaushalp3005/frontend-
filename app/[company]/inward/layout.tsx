import type React from "react"
import { InwardLock } from "@/components/modules/inward/InwardLock"

interface InwardLayoutProps {
  children: React.ReactNode
  params: { company: string }
}

// Inward has shifted to erpcf.in: every inward page is locked behind that notice.
export default function InwardLayout({ children, params }: InwardLayoutProps) {
  return <InwardLock company={params.company}>{children}</InwardLock>
}
