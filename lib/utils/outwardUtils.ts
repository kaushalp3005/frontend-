// File: outwardUtils.ts
// Path: frontend/lib/utils/outwardUtils.ts

import { format } from "date-fns"

/**
 * Generates a consignment number with the format "CONS-YYYYMMDDHHMM"
 * @param date Optional date object, defaults to current date/time
 * @returns Formatted consignment number
 */
export function generateConsignmentNumber(date?: Date): string {
  const now = date || new Date()
  const timestamp = format(now, "yyyyMMddHHmm")
  return `CONS-${timestamp}`
}

/**
 * Validates if a consignment number follows the correct format
 * @param consignmentNo The consignment number to validate
 * @returns True if valid, false otherwise
 */
export function validateConsignmentNumber(consignmentNo: string): boolean {
  const pattern = /^CONS-\d{12}$/
  return pattern.test(consignmentNo)
}

/**
 * Extracts the date from a consignment number
 * @param consignmentNo The consignment number
 * @returns Date object or null if invalid
 */
export function parseConsignmentNumber(consignmentNo: string): Date | null {
  if (!validateConsignmentNumber(consignmentNo)) {
    return null
  }
  
  const timestamp = consignmentNo.replace("CONS-", "")
  const year = parseInt(timestamp.substring(0, 4))
  const month = parseInt(timestamp.substring(4, 6)) - 1 // Month is 0-indexed
  const day = parseInt(timestamp.substring(6, 8))
  const hour = parseInt(timestamp.substring(8, 10))
  const minute = parseInt(timestamp.substring(10, 12))
  
  return new Date(year, month, day, hour, minute)
}

/**
 * Calculates total invoice amount (invoice_amount + invoice_gst_amount)
 * @param invoiceAmount Base invoice amount
 * @param gstAmount GST amount
 * @returns Total invoice amount
 */
export function calculateTotalInvoiceAmount(invoiceAmount: number, gstAmount: number): number {
  return invoiceAmount + gstAmount
}

/**
 * Calculates total freight amount (freight_amount + freight_gst_amount)
 * @param freightAmount Base freight amount
 * @param gstAmount GST amount
 * @returns Total freight amount
 */
export function calculateTotalFreightAmount(freightAmount: number, gstAmount: number): number {
  return freightAmount + gstAmount
}

/**
 * Formats a number as currency (INR)
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

