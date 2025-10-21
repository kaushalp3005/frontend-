// components/ui/ProgressBar.tsx
"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  label?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "success" | "warning" | "error"
}

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3"
}

const variantClasses = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500"
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  label,
  size = "md",
  variant = "default"
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>{label || "Progress"}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out rounded-full",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
