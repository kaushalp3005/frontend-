"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useCountUp } from "@/hooks/useCountUp"
import type { LucideIcon } from "lucide-react"

interface KPICardProps {
  label: string
  value: number
  suffix?: string
  icon: LucideIcon
  iconColor: string
  onClick?: () => void
  pulse?: boolean
  borderColor?: string
  bgColor?: string
  formatValue?: (v: number) => string
}

export function KPICard({
  label, value, suffix, icon: Icon, iconColor, onClick, pulse, borderColor, bgColor, formatValue,
}: KPICardProps) {
  const animated = useCountUp(value)
  const display = formatValue ? formatValue(animated) : animated.toLocaleString("en-IN", { maximumFractionDigits: 1 })

  return (
    <Card
      className={`transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : ""} ${borderColor || ""} ${bgColor || ""} ${pulse ? "animate-pulse-subtle" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-[11px] font-medium text-gray-500">{label}</span>
        </div>
        <p className="text-2xl font-bold">
          {display}
          {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  )
}
