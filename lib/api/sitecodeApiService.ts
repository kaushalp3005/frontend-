// lib/api/sitecodeApiService.ts
// API service for sitecode operations

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface Sitecode {
  id: number
  sitecode: string
  is_active: boolean
}

export interface CreateSitecodePayload {
  sitecode: string
}

/**
 * Fetch all sitecodes
 * GET /outward/dropdowns/sitecodes
 */
export async function getSitecodes(activeOnly: boolean = true): Promise<Sitecode[]> {
  const query = new URLSearchParams()
  query.append('active_only', String(activeOnly))

  const url = `${API_BASE_URL}/outward/dropdowns/sitecodes?${query.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sitecodes: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Create a new sitecode
 * POST /outward/dropdowns/sitecodes
 */
export async function createSitecode(payload: CreateSitecodePayload): Promise<Sitecode> {
  const url = `${API_BASE_URL}/outward/dropdowns/sitecodes`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create sitecode: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

