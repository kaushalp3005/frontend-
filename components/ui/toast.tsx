"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

// Toast Provider
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

// Toast Viewport - fixed position container that holds all toasts
export const ToastViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = "ToastViewport"

// Toast Root with slide-in animation and auto-dismiss visual
export const Toast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "destructive"
    open?: boolean
  }
>(({ className, variant = "default", open = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="alert"
      data-state={open ? "open" : "closed"}
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border p-4 pr-10 shadow-lg",
        "animate-in slide-in-from-bottom-full fade-in-0 duration-300",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
        variant === "destructive"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-gray-200 bg-white text-gray-900",
        className
      )}
      {...props}
    />
  )
})
Toast.displayName = "Toast"

// Toast Action
export const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-red-200 group-[.destructive]:hover:bg-red-100",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

// Toast Close button
export const ToastClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-gray-400 opacity-60 transition-opacity hover:text-gray-900 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-gray-400",
      "group-[.destructive]:text-red-400 group-[.destructive]:hover:text-red-900",
      className
    )}
    onClick={onClick}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
))
ToastClose.displayName = "ToastClose"

// Toast Title
export const ToastTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-semibold leading-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

// Toast Description
export const ToastDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-80 leading-snug", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

// Types
export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
export type ToastActionElement = React.ReactElement<typeof ToastAction>
