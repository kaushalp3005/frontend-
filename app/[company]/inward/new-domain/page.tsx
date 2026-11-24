"use client"

import { PermissionGuard } from "@/components/auth/permission-gate"
import { NewDomainNotice } from "@/components/modules/inward/NewDomainNotice"

interface InwardNewDomainPageProps {
  params: { company: string }
}

export default function InwardNewDomainPage({ params }: InwardNewDomainPageProps) {
  return (
    <PermissionGuard module="inward" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-2xl mx-auto">
        <NewDomainNotice company={params.company} />
      </div>
    </PermissionGuard>
  )
}
