"use client"

import { Card, CardContent } from "@/components/ui/card"

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className || ""}`} />
  )
}

export function SkeletonSummary() {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Shimmer className="h-4 w-4 rounded" />
                <Shimmer className="h-3 w-16" />
              </div>
              <Shimmer className="h-7 w-20 mb-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters placeholder */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <Shimmer className="h-4 w-24" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <Shimmer key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table placeholder */}
      <Card>
        <div className="p-4 space-y-3">
          <Shimmer className="h-8 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}
