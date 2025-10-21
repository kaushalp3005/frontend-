// File: JobCardsList.tsx
// Path: frontend/src/components/modules/consumption/JobCardsList.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  ClipboardList,
  Eye,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { getJobCards, getJobCardDetail } from "@/lib/api/consumptionApiService"
import { JobCard, JobCardStatus, Priority, JobCardDetail as JobCardDetailType } from "@/types/consumption"

interface JobCardsListProps {
  company: string
}

export function JobCardsList({ company }: JobCardsListProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectedJobCard, setSelectedJobCard] = useState<JobCardDetailType | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<JobCardStatus | "">("")
  const [selectedPriority, setSelectedPriority] = useState<Priority | "">("")
  const [selectedSKU, setSelectedSKU] = useState<string>("")
  const [dueDateFrom, setDueDateFrom] = useState<string>("")
  const [dueDateTo, setDueDateTo] = useState<string>("")

  const statusColors = {
    PLANNED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800"
  }

  const statusIcons = {
    PLANNED: Clock,
    IN_PROGRESS: AlertCircle,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle
  }

  const priorityColors = {
    HIGH: "bg-red-100 text-red-800",
    NORMAL: "bg-blue-100 text-blue-800",
    LOW: "bg-gray-100 text-gray-800"
  }

  const fetchJobCards = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getJobCards({
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        due_date_from: dueDateFrom || undefined,
        due_date_to: dueDateTo || undefined,
        sku_id: selectedSKU || undefined,
        page: currentPage,
        per_page: 20
      })

      setJobCards(response.data)
      setTotalRecords(response.total)
      setTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching job cards:", err)
      setError(err instanceof Error ? err.message : "Failed to load job cards")
    } finally {
      setLoading(false)
    }
  }

  const fetchJobCardDetail = async (jobCardNo: string) => {
    try {
      setDetailLoading(true)
      const response = await getJobCardDetail(jobCardNo)
      setSelectedJobCard(response.data)
    } catch (err) {
      console.error("Error fetching job card detail:", err)
      setError(err instanceof Error ? err.message : "Failed to load job card details")
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchJobCards()
  }, [company, currentPage])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchJobCards()
  }

  const handleReset = () => {
    setSelectedStatus("")
    setSelectedPriority("")
    setSelectedSKU("")
    setDueDateFrom("")
    setDueDateTo("")
    setSearchTerm("")
    setCurrentPage(1)
    fetchJobCards()
  }

  const filteredData = jobCards.filter(jobCard =>
    jobCard.job_card_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jobCard.sku_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jobCard.sku_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusCounts = () => {
    const counts = { PLANNED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }
    jobCards.forEach(jobCard => {
      counts[jobCard.status]++
    })
    return counts
  }

  const statusCounts = getStatusCounts()

  if (loading && jobCards.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading job cards...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => {
          const Icon = statusIcons[status as JobCardStatus]
          const colorClass = statusColors[status as JobCardStatus]
          
          return (
            <Card key={status}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{status.replace('_', ' ')}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  Job cards
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Job Card Filters
          </CardTitle>
          <CardDescription>
            Filter job cards by status, priority, and other criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={selectedStatus || "all"} onValueChange={(value) => setSelectedStatus(value === "all" ? "" : value as JobCardStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={selectedPriority || "all"} onValueChange={(value) => setSelectedPriority(value === "all" ? "" : value as Priority)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU ID</Label>
              <Input
                id="sku"
                placeholder="Enter SKU ID"
                value={selectedSKU}
                onChange={(e) => setSelectedSKU(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-from">Due Date From</Label>
              <Input
                id="due-from"
                type="date"
                value={dueDateFrom}
                onChange={(e) => setDueDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-to">Due Date To</Label>
              <Input
                id="due-to"
                type="date"
                value={dueDateTo}
                onChange={(e) => setDueDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Job Card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Job Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by Job Card No, SKU ID, or SKU Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Cards Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Cards</CardTitle>
              <CardDescription>
                Production job cards with status tracking
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={fetchJobCards}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center text-red-600 mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card No</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Planned Qty</TableHead>
                  <TableHead>Actual Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Production Line</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((jobCard) => {
                  const StatusIcon = statusIcons[jobCard.status]
                  
                  return (
                    <TableRow key={jobCard.job_card_no}>
                      <TableCell className="font-mono font-medium">{jobCard.job_card_no}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{jobCard.sku_id}</div>
                          <div className="text-sm text-muted-foreground">{jobCard.sku_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>{jobCard.planned_qty.toLocaleString()}</TableCell>
                      <TableCell>{jobCard.actual_qty.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[jobCard.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {jobCard.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[jobCard.priority]}>
                          {jobCard.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{jobCard.due_date}</TableCell>
                      <TableCell>{jobCard.production_line}</TableCell>
                      <TableCell>{jobCard.shift}</TableCell>
                      <TableCell>{new Date(jobCard.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchJobCardDetail(jobCard.job_card_no)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Job Card Details - {jobCard.job_card_no}</DialogTitle>
                              <DialogDescription>
                                Complete job card information with requirements, issues, and receipts
                              </DialogDescription>
                            </DialogHeader>
                            
                            {detailLoading ? (
                              <div className="flex items-center justify-center h-32">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              </div>
                            ) : selectedJobCard ? (
                              <div className="space-y-6">
                                {/* Basic Info */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Basic Information</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium">SKU</Label>
                                        <p className="text-sm text-muted-foreground">{selectedJobCard.sku_name}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">BOM</Label>
                                        <p className="text-sm text-muted-foreground">{selectedJobCard.bom_name}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Planned Quantity</Label>
                                        <p className="text-sm text-muted-foreground">{selectedJobCard.planned_qty}</p>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Actual Quantity</Label>
                                        <p className="text-sm text-muted-foreground">{selectedJobCard.actual_qty}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Requirements */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Material Requirements</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>SKU</TableHead>
                                          <TableHead>Material Type</TableHead>
                                          <TableHead>Standard Qty</TableHead>
                                          <TableHead>Issued Qty</TableHead>
                                          <TableHead>Qty with Loss</TableHead>
                                          <TableHead>UOM</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {selectedJobCard.requirements.map((req, index) => (
                                          <TableRow key={index}>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium">{req.sku_id}</div>
                                                <div className="text-sm text-muted-foreground">{req.sku_name}</div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Badge className={statusColors[req.material_type as JobCardStatus]}>
                                                {req.material_type}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{req.std_qty}</TableCell>
                                            <TableCell>{req.issued_qty}</TableCell>
                                            <TableCell>{req.qty_with_loss}</TableCell>
                                            <TableCell>{req.uom}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>

                                {/* Issues */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Material Issues</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Time</TableHead>
                                          <TableHead>SKU</TableHead>
                                          <TableHead>Lot/Batch</TableHead>
                                          <TableHead>Qty Issued</TableHead>
                                          <TableHead>Warehouse</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {selectedJobCard.issues.map((issue, index) => (
                                          <TableRow key={index}>
                                            <TableCell>{new Date(issue.time).toLocaleString()}</TableCell>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium">{issue.sku_id}</div>
                                                <div className="text-sm text-muted-foreground">{issue.sku_name}</div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium">{issue.lot_no}</div>
                                                <div className="text-sm text-muted-foreground">{issue.batch_no}</div>
                                              </div>
                                            </TableCell>
                                            <TableCell>{issue.qty_issued}</TableCell>
                                            <TableCell>{issue.warehouse}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>

                                {/* Receipts */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Production Receipts</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Time</TableHead>
                                          <TableHead>Output Type</TableHead>
                                          <TableHead>SKU</TableHead>
                                          <TableHead>Qty Produced</TableHead>
                                          <TableHead>Yield %</TableHead>
                                          <TableHead>Scrap Qty</TableHead>
                                          <TableHead>QC Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {selectedJobCard.receipts.map((receipt, index) => (
                                          <TableRow key={index}>
                                            <TableCell>{new Date(receipt.time).toLocaleString()}</TableCell>
                                            <TableCell>
                                              <Badge className={statusColors[receipt.output_type as JobCardStatus]}>
                                                {receipt.output_type}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium">{receipt.sku_id}</div>
                                                <div className="text-sm text-muted-foreground">{receipt.sku_name}</div>
                                              </div>
                                            </TableCell>
                                            <TableCell>{receipt.qty_produced}</TableCell>
                                            <TableCell>{receipt.yield_pct}%</TableCell>
                                            <TableCell>{receipt.scrap_qty}</TableCell>
                                            <TableCell>
                                              <Badge className={receipt.qc_status === 'PASSED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                                {receipt.qc_status}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>

                                {/* Variances */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Variances</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>SKU</TableHead>
                                          <TableHead>Standard Qty</TableHead>
                                          <TableHead>Actual Qty</TableHead>
                                          <TableHead>Variance Qty</TableHead>
                                          <TableHead>Variance %</TableHead>
                                          <TableHead>Reason</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {selectedJobCard.variances.map((variance, index) => (
                                          <TableRow key={index}>
                                            <TableCell>
                                              <div>
                                                <div className="font-medium">{variance.sku_id}</div>
                                                <div className="text-sm text-muted-foreground">{variance.sku_name}</div>
                                              </div>
                                            </TableCell>
                                            <TableCell>{variance.std_qty}</TableCell>
                                            <TableCell>{variance.actual_qty}</TableCell>
                                            <TableCell className={variance.variance_qty > 0 ? 'text-red-600' : 'text-green-600'}>
                                              {variance.variance_qty > 0 ? '+' : ''}{variance.variance_qty}
                                            </TableCell>
                                            <TableCell className={variance.variance_pct > 0 ? 'text-red-600' : 'text-green-600'}>
                                              {variance.variance_pct > 0 ? '+' : ''}{variance.variance_pct}%
                                            </TableCell>
                                            <TableCell>{variance.reason}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No job cards found</p>
              <p className="text-sm">Try adjusting your filters or search criteria</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalRecords)} of {totalRecords} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
