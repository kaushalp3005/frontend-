// components/modules/inward/ArticleEditor.tsx
"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Package, X, Loader2, AlertCircle, CheckCircle, Search, List,
} from "lucide-react"
import { dropdownApi, type Company } from "@/lib/api"

export interface ArticleFields {
  item_description: string
  po_weight?: number
  sku_id?: number | null
  material_type?: string
  item_category?: string
  sub_category?: string
  uom?: string
  unit_rate?: number
  total_amount?: number
  skuStatus?: "idle" | "loading" | "resolved" | "error"
  skuError?: string
}

const UOM_OPTIONS = ["BOX", "BAG", "CARTON"] as const

interface SearchResult {
  id: number
  item_description: string
  material_type?: string
  group?: string
  sub_group?: string
}

interface ArticleEditorProps {
  article: ArticleFields
  index: number
  company: Company | string
  onChange: (index: number, field: keyof ArticleFields, value: any) => void
  onRemove: (index: number) => void
  onRetrySkuLookup?: (index: number) => void
  removable?: boolean
}

export function ArticleEditor({
  article,
  index,
  company,
  onChange,
  onRemove,
  onRetrySkuLookup,
  removable = true,
}: ArticleEditorProps) {
  type Mode = "search" | "dropdown"
  const [mode, setMode] = useState<Mode>("search")

  // ─── Search mode state ───────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ─── Dropdown mode state ─────────────────────────
  const [materialTypes, setMaterialTypes] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [subCategories, setSubCategories] = useState<string[]>([])
  const [itemDescriptions, setItemDescriptions] = useState<{ desc: string; id: number }[]>([])
  const [ddLoading, setDdLoading] = useState<string | null>(null) // which level is loading

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load material types when switching to dropdown mode
  useEffect(() => {
    if (mode === "dropdown" && materialTypes.length === 0) {
      loadMaterialTypes()
    }
  }, [mode])

  // ─── Search mode handlers ────────────────────────
  const doSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const data = await dropdownApi.globalSearch({ company, search: query })
      setSearchResults(data.items || [])
      setSearchTotal(data.meta?.total_items ?? data.items?.length ?? 0)
      setShowResults(true)
    } catch (err) {
      console.error("Global search failed:", err)
      setSearchError("Search failed. Check connection.")
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [company])

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const handleSelectSearchItem = (item: SearchResult) => {
    onChange(index, "item_description", item.item_description)
    onChange(index, "sku_id", item.id)
    onChange(index, "material_type", item.material_type || "")
    onChange(index, "item_category", item.group || "")
    onChange(index, "sub_category", item.sub_group || "")
    onChange(index, "skuStatus", "resolved")
    onChange(index, "skuError", "")
    setSearchQuery("")
    setShowResults(false)
    setSearchResults([])
  }

  // ─── Dropdown mode handlers ──────────────────────
  const loadMaterialTypes = async () => {
    setDdLoading("material_type")
    try {
      const data = await dropdownApi.skuDropdown({ company })
      setMaterialTypes(data.options.material_types || [])
    } catch (err) {
      console.error("Failed to load material types:", err)
    } finally {
      setDdLoading(null)
    }
  }

  const handleMaterialTypeChange = async (value: string) => {
    onChange(index, "material_type", value)
    onChange(index, "item_category", "")
    onChange(index, "sub_category", "")
    onChange(index, "item_description", "")
    onChange(index, "sku_id", null)
    onChange(index, "skuStatus", "idle")
    setSubCategories([])
    setItemDescriptions([])

    setDdLoading("item_category")
    try {
      const data = await dropdownApi.skuDropdown({ company, material_type: value })
      setCategories(data.options.item_categories || [])
    } catch (err) {
      console.error("Failed to load categories:", err)
    } finally {
      setDdLoading(null)
    }
  }

  const handleCategoryChange = async (value: string) => {
    onChange(index, "item_category", value)
    onChange(index, "sub_category", "")
    onChange(index, "item_description", "")
    onChange(index, "sku_id", null)
    onChange(index, "skuStatus", "idle")
    setItemDescriptions([])

    setDdLoading("sub_category")
    try {
      const data = await dropdownApi.skuDropdown({
        company,
        material_type: article.material_type,
        item_category: value,
      })
      setSubCategories(data.options.sub_categories || [])
    } catch (err) {
      console.error("Failed to load sub-categories:", err)
    } finally {
      setDdLoading(null)
    }
  }

  const handleSubCategoryChange = async (value: string) => {
    onChange(index, "sub_category", value)
    onChange(index, "item_description", "")
    onChange(index, "sku_id", null)
    onChange(index, "skuStatus", "idle")

    setDdLoading("item_description")
    try {
      const data = await dropdownApi.skuDropdown({
        company,
        material_type: article.material_type,
        item_category: article.item_category,
        sub_category: value,
      })
      const descs = (data.options.item_descriptions || []).map((d: string, i: number) => ({
        desc: d,
        id: data.options.item_ids?.[i] ?? 0,
      }))
      setItemDescriptions(descs)
    } catch (err) {
      console.error("Failed to load item descriptions:", err)
    } finally {
      setDdLoading(null)
    }
  }

  const handleItemDescriptionChange = (value: string) => {
    onChange(index, "item_description", value)
    const match = itemDescriptions.find((d) => d.desc === value)
    if (match) {
      onChange(index, "sku_id", match.id)
      onChange(index, "skuStatus", "resolved")
    } else {
      onChange(index, "sku_id", null)
      onChange(index, "skuStatus", "idle")
    }
  }

  // ─── Clear / reset ──────────────────────────────
  const handleClearSelection = () => {
    onChange(index, "item_description", "")
    onChange(index, "sku_id", null)
    onChange(index, "material_type", "")
    onChange(index, "item_category", "")
    onChange(index, "sub_category", "")
    onChange(index, "skuStatus", "idle")
    setSearchQuery("")
    setCategories([])
    setSubCategories([])
    setItemDescriptions([])
  }

  const isResolved = !!article.item_description && (!!article.sku_id || !!article.material_type || !!article.item_category)

  return (
    <div className="p-3 sm:p-4 border rounded-lg bg-muted/20 space-y-3 overflow-visible">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          </div>
          <span className="text-xs sm:text-sm font-medium">Article {index + 1}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {article.skuStatus === "loading" && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Looking up...</span>
            </Badge>
          )}
          {isResolved && article.sku_id && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle className="h-3 w-3" />
              <span className="hidden xs:inline">SKU:</span> {article.sku_id}
            </Badge>
          )}
          {isResolved && !article.sku_id && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs gap-1 bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="h-3 w-3" />
              No SKU
            </Badge>
          )}
          {article.skuStatus === "error" && (
            <Badge variant="destructive" className="text-[10px] sm:text-xs gap-1">
              <AlertCircle className="h-3 w-3" />
              <span className="truncate max-w-[80px] sm:max-w-none">{article.skuError || "SKU not found"}</span>
            </Badge>
          )}
          {removable && (
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => onRemove(index)}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* ═══════ Resolved state ═══════ */}
      {isResolved ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium break-words">{article.item_description}</p>
              <div className="flex flex-wrap gap-1">
                {article.material_type && <Badge variant="outline" className="text-[10px] sm:text-xs">{article.material_type}</Badge>}
                {article.item_category && <Badge variant="outline" className="text-[10px] sm:text-xs">{article.item_category}</Badge>}
                {article.sub_category && <Badge variant="outline" className="text-[10px] sm:text-xs">{article.sub_category}</Badge>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={handleClearSelection}
            >
              Change
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Material Type</Label>
              <Input value={article.material_type || "—"} readOnly className="h-8 sm:h-9 bg-muted text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Category</Label>
              <Input value={article.item_category || "—"} readOnly className="h-8 sm:h-9 bg-muted text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Sub Category</Label>
              <Input value={article.sub_category || "—"} readOnly className="h-8 sm:h-9 bg-muted text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">UOM</Label>
              <Select value={article.uom || ""} onValueChange={(v) => onChange(index, "uom", v)}>
                <SelectTrigger className="h-8 sm:h-9">
                  <SelectValue placeholder="UOM" />
                </SelectTrigger>
                <SelectContent>
                  {UOM_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Article-level amounts */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">PO Weight</Label>
              <Input
                type="number"
                value={article.po_weight ?? ""}
                onChange={(e) => onChange(index, "po_weight", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Unit Rate</Label>
              <Input
                type="number"
                value={article.unit_rate ?? ""}
                onChange={(e) => onChange(index, "unit_rate", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Total Amount</Label>
              <Input
                type="number"
                value={article.total_amount ?? ""}
                onChange={(e) => onChange(index, "total_amount", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
          </div>
        </div>
      ) : (
        /* ═══════ Input mode ═══════ */
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg w-fit">
            <button
              type="button"
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${
                mode === "search" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("search")}
            >
              <Search className="h-3 w-3" />
              Search
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${
                mode === "dropdown" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("dropdown")}
            >
              <List className="h-3 w-3" />
              Browse
            </button>
          </div>

          {/* ─── Search mode ─── */}
          {mode === "search" && (
            <div className="relative" ref={wrapperRef}>
              <Label className="text-xs mb-1.5 block">Search Item Description</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true) }}
                  placeholder="Type to search items..."
                  className="h-9 pl-8 pr-8"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>

              {searchError && <p className="text-xs text-destructive mt-1">{searchError}</p>}

              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg flex flex-col" style={{ maxHeight: "min(480px, 60vh)" }}>
                  <div className="overflow-y-auto flex-1">
                    {searchResults.map((item) => (
                      <button
                        key={`${item.id}-${item.item_description}`}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-0"
                        onClick={() => handleSelectSearchItem(item)}
                      >
                        <p className="text-sm font-medium truncate">{item.item_description}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          {item.material_type && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.material_type}</span>
                          )}
                          {item.group && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.group}</span>
                          )}
                          {item.sub_group && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.sub_group}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">ID: {item.id}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground text-center rounded-b-lg flex-shrink-0">
                    Showing {searchResults.length} of {searchTotal} results
                  </div>
                </div>
              )}

              {showResults && searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
                  No items found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}

          {/* ─── Dropdown / Browse mode ─── */}
          {mode === "dropdown" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {/* Material Type */}
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Material Type</Label>
                <Select
                  value={article.material_type || ""}
                  onValueChange={handleMaterialTypeChange}
                  disabled={ddLoading === "material_type"}
                >
                  <SelectTrigger className="h-8 sm:h-9">
                    <SelectValue placeholder={ddLoading === "material_type" ? "Loading..." : "Select type"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {materialTypes.map((mt) => (
                      <SelectItem key={mt} value={mt}>{mt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Item Category */}
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Category</Label>
                <Select
                  value={article.item_category || ""}
                  onValueChange={handleCategoryChange}
                  disabled={!article.material_type || ddLoading === "item_category"}
                >
                  <SelectTrigger className="h-8 sm:h-9">
                    <SelectValue placeholder={ddLoading === "item_category" ? "Loading..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub Category */}
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Sub Category</Label>
                <Select
                  value={article.sub_category || ""}
                  onValueChange={handleSubCategoryChange}
                  disabled={!article.item_category || ddLoading === "sub_category"}
                >
                  <SelectTrigger className="h-8 sm:h-9">
                    <SelectValue placeholder={ddLoading === "sub_category" ? "Loading..." : "Select sub-cat"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {subCategories.map((sc) => (
                      <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Item Description */}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] sm:text-xs">Item Description</Label>
                <Select
                  value={article.item_description || ""}
                  onValueChange={handleItemDescriptionChange}
                  disabled={!article.sub_category || ddLoading === "item_description"}
                >
                  <SelectTrigger className="h-8 sm:h-9">
                    <SelectValue placeholder={ddLoading === "item_description" ? "Loading..." : "Select item"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px] min-w-[300px]">
                    {itemDescriptions.map((d) => (
                      <SelectItem key={`${d.id}-${d.desc}`} value={d.desc}>{d.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* UOM + Article amounts — always visible in input mode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs">UOM</Label>
              <Select value={article.uom || ""} onValueChange={(v) => onChange(index, "uom", v)}>
                <SelectTrigger className="h-8 sm:h-9">
                  <SelectValue placeholder="UOM" />
                </SelectTrigger>
                <SelectContent>
                  {UOM_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs">PO Weight</Label>
              <Input
                type="number"
                value={article.po_weight ?? ""}
                onChange={(e) => onChange(index, "po_weight", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs">Unit Rate</Label>
              <Input
                type="number"
                value={article.unit_rate ?? ""}
                onChange={(e) => onChange(index, "unit_rate", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] sm:text-xs">Total Amount</Label>
              <Input
                type="number"
                value={article.total_amount ?? ""}
                onChange={(e) => onChange(index, "total_amount", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="h-8 sm:h-9 text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
