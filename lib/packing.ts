// Packing Details API + block-editor helpers.
// Targets the backend's /api/v1/packing-details/* (services/packing_service),
// authenticated with the IMS access token from the Zustand auth store.

import { useAuthStore } from "@/lib/stores/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""
const BASE = "/api/v1/packing-details"

export interface PackingDetail {
  id: number
  batch_code: string
  article_name: string
  details: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

function authHeaders(): Record<string, string> {
  const { accessToken, user } = useAuthStore.getState()
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(user?.email ? { "X-User-Email": user.email } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const b = await res.json()
      if (b?.detail) detail = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail)
      else if (b?.message) detail = String(b.message)
      else if (b?.error) detail = String(b.error)
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function listPackingDetails(
  p: { batch_code?: string; article_name?: string; limit?: number } = {},
): Promise<PackingDetail[]> {
  const qs = new URLSearchParams()
  if (p.batch_code) qs.set("batch_code", p.batch_code)
  if (p.article_name) qs.set("article_name", p.article_name)
  qs.set("limit", String(p.limit ?? 200))
  return req<PackingDetail[]>(`${BASE}?${qs.toString()}`)
}

export const getPackingDetail = (id: number) => req<PackingDetail>(`${BASE}/${id}`)

export const createPackingDetail = (body: {
  batch_code: string
  article_name: string
  details: Record<string, unknown>
}) => req<PackingDetail>(BASE, { method: "POST", body: JSON.stringify(body) })

export const updatePackingDetail = (
  id: number,
  body: { batch_code?: string; article_name?: string; details?: Record<string, unknown> },
) => req<PackingDetail>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(body) })

export const deletePackingDetail = (id: number) =>
  req<void>(`${BASE}/${id}`, { method: "DELETE" })

export const mintBatchToken = (batch_code: string) =>
  req<{ batch_token: string }>(`${BASE}/batch-token`, {
    method: "POST",
    body: JSON.stringify({ batch_code }),
  })

export const fetchByEncryptedBatch = (batch_token: string) =>
  req<PackingDetail[]>(`${BASE}/by-encrypted-batch`, {
    method: "POST",
    body: JSON.stringify({ batch_token }),
  })

// ── Block editor model + converters (details JSON <-> labelled blocks) ──────
export type BlockType = "text" | "number" | "boolean" | "date" | "list" | "json"

export interface Block {
  id: string
  label: string
  type: BlockType
  value: string
}

let _seq = 0
export function emptyBlock(): Block {
  _seq += 1
  return { id: `blk_${_seq}`, label: "", type: "text", value: "" }
}

function coerce(b: Block): unknown {
  const raw = b.value
  switch (b.type) {
    case "number": {
      if (raw.trim() === "") return null
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    }
    case "boolean":
      return raw === "true"
    case "date":
      return raw
    case "list":
      return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    case "json":
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    default:
      return raw
  }
}

export function blocksToDetails(blocks: Block[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const b of blocks) {
    const key = b.label.trim()
    if (!key) continue
    out[key] = coerce(b)
  }
  return out
}

export function blocksError(blocks: Block[]): string | null {
  const seen = new Set<string>()
  for (const b of blocks) {
    const key = b.label.trim()
    if (!key) continue
    if (seen.has(key)) return `Duplicate field name "${key}" — each block needs a unique name.`
    seen.add(key)
    if (b.type === "number" && b.value.trim() !== "" && Number.isNaN(Number(b.value))) {
      return `Block "${key}": "${b.value}" is not a valid number.`
    }
    if (b.type === "json") {
      try {
        JSON.parse(b.value)
      } catch {
        return `Block "${key}": value is not valid JSON.`
      }
    }
  }
  return null
}

function inferType(value: unknown): [BlockType, string] {
  if (typeof value === "number") return ["number", String(value)]
  if (typeof value === "boolean") return ["boolean", value ? "true" : "false"]
  if (Array.isArray(value)) {
    const primitive = value.every((v) => typeof v === "string" || typeof v === "number")
    return primitive ? ["list", value.join(", ")] : ["json", JSON.stringify(value, null, 2)]
  }
  if (value !== null && typeof value === "object") return ["json", JSON.stringify(value, null, 2)]
  return ["text", value == null ? "" : String(value)]
}

export function detailsToBlocks(details: Record<string, unknown> | null | undefined): Block[] {
  if (!details || typeof details !== "object") return []
  return Object.entries(details).map(([label, value]) => {
    const [type, raw] = inferType(value)
    _seq += 1
    return { id: `blk_${_seq}`, label, type, value: raw }
  })
}
