// File: AdminMasters.tsx
// Path: frontend/src/components/modules/consumption/AdminMasters.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Package, 
  Warehouse, 
  Settings, 
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2
} from "lucide-react"
import { getSKUs, getWarehouses, getBOMs } from "@/lib/api/consumptionApiService"
import { SKU, Warehouse as WarehouseType, BOM, MaterialType } from "@/types/consumption"

interface AdminMastersProps {
  company: string
}

export function AdminMasters({ company }: AdminMastersProps) {
  const [activeTab, setActiveTab] = useState("skus")
  
  // SKU state
  const [skus, setSkus] = useState<SKU[]>([])
  const [skuLoading, setSkuLoading] = useState(false)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [skuPage, setSkuPage] = useState(1)
  const [skuTotalPages, setSkuTotalPages] = useState(1)
  const [skuTotalRecords, setSkuTotalRecords] = useState(0)
  const [skuSearch, setSkuSearch] = useState("")
  const [skuMaterialType, setSkuMaterialType] = useState<MaterialType | "">("")
  const [skuActiveOnly, setSkuActiveOnly] = useState(true)

  // Warehouse state
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [warehouseError, setWarehouseError] = useState<string | null>(null)
  const [warehousePage, setWarehousePage] = useState(1)
  const [warehouseTotalPages, setWarehouseTotalPages] = useState(1)
  const [warehouseTotalRecords, setWarehouseTotalRecords] = useState(0)
  const [warehouseSearch, setWarehouseSearch] = useState("")
  const [warehouseType, setWarehouseType] = useState<string>("")
  const [warehouseActiveOnly, setWarehouseActiveOnly] = useState(true)

  // BOM state
  const [boms, setBoms] = useState<BOM[]>([])
  const [bomLoading, setBomLoading] = useState(false)
  const [bomError, setBomError] = useState<string | null>(null)
  const [bomPage, setBomPage] = useState(1)
  const [bomTotalPages, setBomTotalPages] = useState(1)
  const [bomTotalRecords, setBomTotalRecords] = useState(0)
  const [bomSearch, setBomSearch] = useState("")
  const [bomOutputSku, setBomOutputSku] = useState("")
  const [bomActiveOnly, setBomActiveOnly] = useState(true)

  const materialTypeColors = {
    RM: "bg-blue-100 text-blue-800",
    PM: "bg-green-100 text-green-800",
    SFG: "bg-yellow-100 text-yellow-800",
    FG: "bg-purple-100 text-purple-800"
  }

  const materialTypeLabels = {
    RM: "Raw Materials",
    PM: "Packaging Materials",
    SFG: "Semi-Finished Goods",
    FG: "Finished Goods"
  }

  const warehouseTypeColors = {
    STORAGE: "bg-blue-100 text-blue-800",
    QC_HOLD: "bg-yellow-100 text-yellow-800",
    PUTAWAY: "bg-green-100 text-green-800"
  }

  const warehouseTypeLabels = {
    STORAGE: "Storage",
    QC_HOLD: "QC Hold",
    PUTAWAY: "Putaway"
  }

  // SKU functions
  const fetchSKUs = async () => {
    try {
      setSkuLoading(true)
      setSkuError(null)

      const response = await getSKUs({
        page: skuPage,
        per_page: 20,
        material_type: skuMaterialType || undefined,
        search: skuSearch || undefined,
        is_active: skuActiveOnly
      })

      setSkus(response.data)
      setSkuTotalRecords(response.total)
      setSkuTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching SKUs:", err)
      setSkuError(err instanceof Error ? err.message : "Failed to load SKUs")
    } finally {
      setSkuLoading(false)
    }
  }

  // Warehouse functions
  const fetchWarehouses = async () => {
    try {
      setWarehouseLoading(true)
      setWarehouseError(null)

      const response = await getWarehouses({
        page: warehousePage,
        per_page: 20,
        warehouse_type: warehouseType as any || undefined,
        is_active: warehouseActiveOnly
      })

      setWarehouses(response.data)
      setWarehouseTotalRecords(response.total)
      setWarehouseTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching warehouses:", err)
      setWarehouseError(err instanceof Error ? err.message : "Failed to load warehouses")
    } finally {
      setWarehouseLoading(false)
    }
  }

  // BOM functions
  const fetchBOMs = async () => {
    try {
      setBomLoading(true)
      setBomError(null)

      const response = await getBOMs({
        page: bomPage,
        per_page: 20,
        output_sku_id: bomOutputSku || undefined,
        is_active: bomActiveOnly
      })

      setBoms(response.data)
      setBomTotalRecords(response.total)
      setBomTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching BOMs:", err)
      setBomError(err instanceof Error ? err.message : "Failed to load BOMs")
    } finally {
      setBomLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "skus") {
      fetchSKUs()
    } else if (activeTab === "warehouses") {
      fetchWarehouses()
    } else if (activeTab === "boms") {
      fetchBOMs()
    }
  }, [company, activeTab, skuPage, warehousePage, bomPage])

  const handleSkuSearch = () => {
    setSkuPage(1)
    fetchSKUs()
  }

  const handleWarehouseSearch = () => {
    setWarehousePage(1)
    fetchWarehouses()
  }

  const handleBomSearch = () => {
    setBomPage(1)
    fetchBOMs()
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="skus" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            SKUs
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Warehouses
          </TabsTrigger>
          <TabsTrigger value="boms" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            BOMs
          </TabsTrigger>
        </TabsList>

        {/* SKUs Tab */}
        <TabsContent value="skus" className="space-y-6">
          {/* SKU Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                SKU Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku-search">Search</Label>
                  <Input
                    id="sku-search"
                    placeholder="Search SKUs..."
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku-material-type">Material Type</Label>
                  <Select value={skuMaterialType || "all"} onValueChange={(value) => setSkuMaterialType(value === "all" ? "" : value as MaterialType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="RM">Raw Materials</SelectItem>
                      <SelectItem value="PM">Packaging Materials</SelectItem>
                      <SelectItem value="SFG">Semi-Finished Goods</SelectItem>
                      <SelectItem value="FG">Finished Goods</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku-active">Active Only</Label>
                  <Select value={skuActiveOnly.toString()} onValueChange={(value) => setSkuActiveOnly(value === "true")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active Only</SelectItem>
                      <SelectItem value="false">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSkuSearch} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SKUs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SKUs</CardTitle>
                  <CardDescription>
                    Manage SKU master data
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add SKU
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchSKUs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {skuError && (
                <div className="text-center text-red-600 mb-4">
                  <p className="text-sm">{skuError}</p>
                </div>
              )}
              
              {skuLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Material Type</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>HSN Code</TableHead>
                        <TableHead>GST Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skus.map((sku) => (
                        <TableRow key={sku.id}>
                          <TableCell className="font-mono font-medium">{sku.id}</TableCell>
                          <TableCell>{sku.name}</TableCell>
                          <TableCell>
                            <Badge className={materialTypeColors[sku.material_type]}>
                              {materialTypeLabels[sku.material_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>{sku.uom}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sku.category}</div>
                              <div className="text-sm text-muted-foreground">{sku.sub_category}</div>
                            </div>
                          </TableCell>
                          <TableCell>{sku.hsn_code}</TableCell>
                          <TableCell>{sku.gst_rate}%</TableCell>
                          <TableCell>
                            <Badge variant={sku.is_active ? "default" : "secondary"}>
                              {sku.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {skus.length === 0 && !skuLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No SKUs found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {/* Pagination */}
              {skuTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((skuPage - 1) * 20) + 1} to {Math.min(skuPage * 20, skuTotalRecords)} of {skuTotalRecords} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSkuPage(prev => Math.max(1, prev - 1))}
                      disabled={skuPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
                      Page {skuPage} of {skuTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSkuPage(prev => Math.min(skuTotalPages, prev + 1))}
                      disabled={skuPage === skuTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses" className="space-y-6">
          {/* Warehouse Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Warehouse Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouse-search">Search</Label>
                  <Input
                    id="warehouse-search"
                    placeholder="Search warehouses..."
                    value={warehouseSearch}
                    onChange={(e) => setWarehouseSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-type">Type</Label>
                  <Select value={warehouseType || "all"} onValueChange={(value) => setWarehouseType(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="STORAGE">Storage</SelectItem>
                      <SelectItem value="QC_HOLD">QC Hold</SelectItem>
                      <SelectItem value="PUTAWAY">Putaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleWarehouseSearch} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warehouses Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Warehouses</CardTitle>
                  <CardDescription>
                    Manage warehouse master data
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Warehouse
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchWarehouses}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {warehouseError && (
                <div className="text-center text-red-600 mb-4">
                  <p className="text-sm">{warehouseError}</p>
                </div>
              )}
              
              {warehouseLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Site Code</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((warehouse) => (
                        <TableRow key={warehouse.code}>
                          <TableCell className="font-mono font-medium">{warehouse.code}</TableCell>
                          <TableCell>{warehouse.name}</TableCell>
                          <TableCell>{warehouse.sitecode}</TableCell>
                          <TableCell>{warehouse.location}</TableCell>
                          <TableCell>
                            <Badge className={warehouseTypeColors[warehouse.warehouse_type]}>
                              {warehouseTypeLabels[warehouse.warehouse_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                              {warehouse.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {warehouses.length === 0 && !warehouseLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No warehouses found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {/* Pagination */}
              {warehouseTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((warehousePage - 1) * 20) + 1} to {Math.min(warehousePage * 20, warehouseTotalRecords)} of {warehouseTotalRecords} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWarehousePage(prev => Math.max(1, prev - 1))}
                      disabled={warehousePage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
                      Page {warehousePage} of {warehouseTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWarehousePage(prev => Math.min(warehouseTotalPages, prev + 1))}
                      disabled={warehousePage === warehouseTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOMs Tab */}
        <TabsContent value="boms" className="space-y-6">
          {/* BOM Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                BOM Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bom-search">Search</Label>
                  <Input
                    id="bom-search"
                    placeholder="Search BOMs..."
                    value={bomSearch}
                    onChange={(e) => setBomSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bom-output-sku">Output SKU</Label>
                  <Input
                    id="bom-output-sku"
                    placeholder="Output SKU ID"
                    value={bomOutputSku}
                    onChange={(e) => setBomOutputSku(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleBomSearch} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BOMs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>BOMs</CardTitle>
                  <CardDescription>
                    Manage Bill of Materials
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add BOM
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchBOMs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bomError && (
                <div className="text-center text-red-600 mb-4">
                  <p className="text-sm">{bomError}</p>
                </div>
              )}
              
              {bomLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>BOM ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Output SKU</TableHead>
                        <TableHead>Output Qty</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Components</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boms.map((bom) => (
                        <TableRow key={bom.id}>
                          <TableCell className="font-mono font-medium">{bom.id}</TableCell>
                          <TableCell>{bom.name}</TableCell>
                          <TableCell className="font-mono">{bom.output_sku_id}</TableCell>
                          <TableCell>{bom.output_qty} {bom.output_uom}</TableCell>
                          <TableCell>{bom.version}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {bom.components.length} components
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={bom.is_active ? "default" : "secondary"}>
                              {bom.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {boms.length === 0 && !bomLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No BOMs found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {/* Pagination */}
              {bomTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((bomPage - 1) * 20) + 1} to {Math.min(bomPage * 20, bomTotalRecords)} of {bomTotalRecords} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBomPage(prev => Math.max(1, prev - 1))}
                      disabled={bomPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
                      Page {bomPage} of {bomTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBomPage(prev => Math.min(bomTotalPages, prev + 1))}
                      disabled={bomPage === bomTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
