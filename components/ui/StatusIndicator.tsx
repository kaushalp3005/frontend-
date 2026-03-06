// components/ui/StatusIndicator.tsx
"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, AlertCircle, Clock, XCircle, Loader2 } from "lucide-react"

interface StatusIndicatorProps {
  status: "idle" | "loading" | "success" | "warning" | "error" | "pending"
  text?: string
  className?: string
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
}

const statusClasses = {
  idle: "text-muted-foreground",
  loading: "text-blue-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  error: "text-red-500",
  pending: "text-orange-500"
}

const iconClasses = {
  idle: Clock,
  loading: Loader2,
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
  pending: Clock
}

const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5"
}

export function StatusIndicator({
  status,
  text,
  className,
  size = "md",
  showIcon = true
}: StatusIndicatorProps) {
  const Icon = iconClasses[status]
  const isAnimated = status === "loading"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <Icon 
          className={cn(
            sizeClasses[size],
            statusClasses[status],
            isAnimated && "animate-spin"
          )} 
        />
      )}
      {text && (
        <span className={cn("text-sm", statusClasses[status])}>
          {text}
        </span>
      )}
    </div>
  )
}
