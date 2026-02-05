/**
 * Warehouse addresses configuration
 * Used across the application for consistent warehouse data
 */

export interface WarehouseAddress {
  name: string
  address: string
}

export const WAREHOUSE_ADDRESSES: Record<string, WarehouseAddress> = {
  "W202": { 
    name: "Warehouse W202", 
    address: "W-202, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400710" 
  },
  "A185": { 
    name: "Warehouse A185", 
    address: "A-185, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709" 
  },
  "A101": { 
    name: "Warehouse A101", 
    address: "A-101, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709" 
  },
  "A68": { 
    name: "Warehouse A68", 
    address: "A-68, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709" 
  },
  "F53": { 
    name: "Warehouse F53", 
    address: "F53, APMC Masala Market, APMC Market, Sector 19, Vashi, Navi Mumbai, Maharashtra 400703" 
  },
  "Savla": { 
    name: "Savla Warehouse", 
    address: "Savla, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709" 
  },
  "Rishi": { 
    name: "Rishi Warehouse", 
    address: "Rishi, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709" 
  }
}

/**
 * Get warehouse display name
 */
export const getWarehouseName = (code: string): string => {
  return WAREHOUSE_ADDRESSES[code]?.name || code
}

/**
 * Get warehouse full address
 */
export const getWarehouseAddress = (code: string): string => {
  return WAREHOUSE_ADDRESSES[code]?.address || 'Address not available'
}

/**
 * Get all warehouse codes
 */
export const getWarehouseCodes = (): string[] => {
  return Object.keys(WAREHOUSE_ADDRESSES)
}
