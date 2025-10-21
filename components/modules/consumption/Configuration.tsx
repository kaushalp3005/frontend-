// File: Configuration.tsx
// Path: frontend/src/components/modules/consumption/Configuration.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Settings, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Shield,
  Clock,
  Calculator,
  Eye
} from "lucide-react"
import { getConfig, updateConfig, getQCHolds } from "@/lib/api/consumptionApiService"
import { SystemConfig, ValuationMethod, QCHoldDetail, QCStatus } from "@/types/consumption"

interface ConfigurationProps {
  company: string
}

export function Configuration({ company }: ConfigurationProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // QC Holds state
  const [qcHolds, setQcHolds] = useState<QCHoldDetail[]>([])
  const [qcHoldsLoading, setQcHoldsLoading] = useState(false)
  const [qcHoldsError, setQcHoldsError] = useState<string | null>(null)
  const [qcHoldsPage, setQcHoldsPage] = useState(1)
  const [qcHoldsTotalPages, setQcHoldsTotalPages] = useState(1)
  const [qcHoldsTotalRecords, setQcHoldsTotalRecords] = useState(0)
  const [selectedWarehouse, setSelectedWarehouse] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<QCStatus | "">("")

  const valuationMethods: { value: ValuationMethod; label: string }[] = [
    { value: "FIFO", label: "First In First Out" },
    { value: "LIFO", label: "Last In First Out" },
    { value: "AVERAGE", label: "Average Cost" }
  ]

  const qcStatusColors = {
    HOLD: "bg-yellow-100 text-yellow-800",
    RELEASE: "bg-green-100 text-green-800",
    REJECT: "bg-red-100 text-red-800"
  }

  const qcStatusLabels = {
    HOLD: "Hold",
    RELEASE: "Released",
    REJECT: "Rejected"
  }

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getConfig()
      setConfig(response.data)
    } catch (err) {
      console.error("Error fetching config:", err)
      setError(err instanceof Error ? err.message : "Failed to load configuration")
    } finally {
      setLoading(false)
    }
  }

  const fetchQCHolds = async () => {
    try {
      setQcHoldsLoading(true)
      setQcHoldsError(null)

      const response = await getQCHolds({
        warehouse: selectedWarehouse || undefined,
        status: selectedStatus || undefined,
        page: qcHoldsPage,
        per_page: 20
      })

      setQcHolds(response.data)
      setQcHoldsTotalRecords(response.total)
      setQcHoldsTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching QC holds:", err)
      setQcHoldsError(err instanceof Error ? err.message : "Failed to load QC holds")
    } finally {
      setQcHoldsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [company])

  useEffect(() => {
    fetchQCHolds()
  }, [company, qcHoldsPage, selectedWarehouse, selectedStatus])

  const handleConfigChange = (field: keyof SystemConfig, value: any) => {
    if (config) {
      setConfig({ ...config, [field]: value })
    }
  }

  const handleSaveConfig = async () => {
    if (!config) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await updateConfig({
        valuation_method: config.valuation_method,
        variance_threshold_pct: config.variance_threshold_pct,
        fifo_expiry_days: config.fifo_expiry_days,
        auto_ledger_calculation: config.auto_ledger_calculation,
        qc_hold_duration_hours: config.qc_hold_duration_hours
      })

      if (response.success) {
        setSuccess(`Configuration updated successfully! Updated fields: ${response.data.updated_fields.join(', ')}`)
      }
    } catch (err) {
      console.error("Error updating config:", err)
      setError(err instanceof Error ? err.message : "Failed to update configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleResetConfig = () => {
    fetchConfig()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading configuration...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="qc-holds" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            QC Holds
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                Configure system settings for consumption management
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Configuration Form */}
          {config && (
            <div className="space-y-6">
              {/* Valuation Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Valuation Method
                  </CardTitle>
                  <CardDescription>
                    Configure how inventory is valued for cost calculations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="valuation-method">Valuation Method</Label>
                    <Select 
                      value={config.valuation_method} 
                      onValueChange={(value) => handleConfigChange('valuation_method', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {valuationMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Determines how inventory costs are calculated when materials are consumed
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Variance Thresholds */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Variance Thresholds
                  </CardTitle>
                  <CardDescription>
                    Set thresholds for variance detection and alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="variance-threshold">Variance Threshold (%)</Label>
                      <Input
                        id="variance-threshold"
                        type="number"
                        value={config.variance_threshold_pct}
                        onChange={(e) => handleConfigChange('variance_threshold_pct', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <p className="text-sm text-muted-foreground">
                        Percentage threshold for variance alerts in material consumption
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* FIFO Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    FIFO Settings
                  </CardTitle>
                  <CardDescription>
                    Configure FIFO (First In First Out) parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fifo-expiry-days">FIFO Expiry Days</Label>
                      <Input
                        id="fifo-expiry-days"
                        type="number"
                        value={config.fifo_expiry_days}
                        onChange={(e) => handleConfigChange('fifo_expiry_days', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                      <p className="text-sm text-muted-foreground">
                        Number of days before expiry to prioritize in FIFO allocation
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    System Settings
                  </CardTitle>
                  <CardDescription>
                    General system configuration options
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-ledger">Auto Ledger Calculation</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically calculate daily ledger entries
                        </p>
                      </div>
                      <Switch
                        id="auto-ledger"
                        checked={config.auto_ledger_calculation}
                        onCheckedChange={(checked) => handleConfigChange('auto_ledger_calculation', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* QC Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Quality Control Settings
                  </CardTitle>
                  <CardDescription>
                    Configure quality control hold duration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="qc-hold-duration">QC Hold Duration (Hours)</Label>
                      <Input
                        id="qc-hold-duration"
                        type="number"
                        value={config.qc_hold_duration_hours}
                        onChange={(e) => handleConfigChange('qc_hold_duration_hours', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                      <p className="text-sm text-muted-foreground">
                        Default duration for QC holds before automatic release
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Actions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleResetConfig}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                    <Button onClick={handleSaveConfig} disabled={saving}>
                      {saving ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* QC Holds Tab */}
        <TabsContent value="qc-holds" className="space-y-6">
          {/* QC Holds Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Quality Control Holds
              </CardTitle>
              <CardDescription>
                Manage quality control holds for production receipts
              </CardDescription>
            </CardHeader>
          </Card>

          {/* QC Holds Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Filter QC Holds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qc-warehouse">Warehouse</Label>
                  <Select value={selectedWarehouse || "all"} onValueChange={(value) => setSelectedWarehouse(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All warehouses</SelectItem>
                      <SelectItem value="WH001">Main Warehouse</SelectItem>
                      <SelectItem value="WH002">Production Warehouse</SelectItem>
                      <SelectItem value="WH003">Storage Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qc-status">Status</Label>
                  <Select value={selectedStatus || "all"} onValueChange={(value) => setSelectedStatus(value === "all" ? "" : value as QCStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="HOLD">Hold</SelectItem>
                      <SelectItem value="RELEASE">Released</SelectItem>
                      <SelectItem value="REJECT">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QC Holds Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>QC Holds</CardTitle>
                  <CardDescription>
                    Quality control holds requiring attention
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchQCHolds}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {qcHoldsError && (
                <div className="text-center text-red-600 mb-4">
                  <p className="text-sm">{qcHoldsError}</p>
                </div>
              )}
              
              {qcHoldsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QC Hold ID</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Lot/Batch</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Hold Reason</TableHead>
                        <TableHead>Hold Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qcHolds.map((hold) => (
                        <TableRow key={hold.id}>
                          <TableCell className="font-mono text-sm">{hold.id}</TableCell>
                          <TableCell>{hold.warehouse}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{hold.item_id}</div>
                              <div className="text-sm text-muted-foreground">{hold.uom}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{hold.lot}</div>
                              <div className="text-sm text-muted-foreground">{hold.batch}</div>
                            </div>
                          </TableCell>
                          <TableCell>{hold.qty.toLocaleString()}</TableCell>
                          <TableCell>{hold.hold_reason}</TableCell>
                          <TableCell>{new Date(hold.hold_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge className={qcStatusColors[hold.status]}>
                              {qcStatusLabels[hold.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm">
                                Release
                              </Button>
                              <Button variant="outline" size="sm">
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {qcHolds.length === 0 && !qcHoldsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No QC holds found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {/* Pagination */}
              {qcHoldsTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((qcHoldsPage - 1) * 20) + 1} to {Math.min(qcHoldsPage * 20, qcHoldsTotalRecords)} of {qcHoldsTotalRecords} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQcHoldsPage(prev => Math.max(1, prev - 1))}
                      disabled={qcHoldsPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
                      Page {qcHoldsPage} of {qcHoldsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQcHoldsPage(prev => Math.min(qcHoldsTotalPages, prev + 1))}
                      disabled={qcHoldsPage === qcHoldsTotalPages}
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
