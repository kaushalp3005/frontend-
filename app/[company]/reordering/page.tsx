"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  RotateCcw, 
  Plus, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package,
  TrendingUp,
  AlertCircle,
  Loader2,
  Printer,
  Trash2
} from "lucide-react"
import { rtvApi } from "@/lib/api/rtvApiService"
import { RTVRecord } from "@/types/rtv"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"

interface ReorderingPageProps {
  params: {
    company: Company
  }
}

export default function ReorderingPage({ params }: ReorderingPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  
  // API states
  const [rtvRecords, setRtvRecords] = useState<RTVRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load RTV records from backend
  useEffect(() => {
    const loadRTVRecords = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        console.log('🔄 Loading RTV records for company:', params.company)
        const response = await rtvApi.getRTVList(params.company, {
          page: 1,
          limit: 100, // Load all records (adjust as needed for pagination)
        })
        
        console.log('✅ RTV records loaded:', response.data)
        setRtvRecords(response.data || [])
      } catch (err) {
        console.error('❌ Error loading RTV records:', err)
        setError('Failed to load RTV records')
        toast({
          title: "Error Loading Records",
          description: "Failed to load RTV records from server",
          variant: "destructive",
        })
        setRtvRecords([]) // Set empty array on error
      } finally {
        setIsLoading(false)
      }
    }

    loadRTVRecords()
  }, [params.company, toast])

  // Calculate statistics from fetched records
  const stats = {
    total: rtvRecords.length,
    totalValue: rtvRecords.reduce((sum, r) => sum + (r.total_value || 0), 0),
    totalBoxes: rtvRecords.reduce((sum, r) => sum + (r.total_boxes || 0), 0),
  }

  const filteredRecords = rtvRecords.filter((record) => {
    const matchesSearch = 
      record.rtv_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.customer_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  const getRTVTypeBadge = (type: RTVRecord["rtv_type"]) => {
    const labels: Record<RTVRecord["rtv_type"], string> = {
      quality_issue: "Quality Issue",
      damaged: "Damaged",
      expired: "Expired",
      excess_quantity: "Excess Qty",
      wrong_item: "Wrong Item",
      other: "Other",
    }
    
    return <Badge variant="outline">{labels[type]}</Badge>
  }

  // Print RTV Summary
  const handlePrintRTV = async (record: RTVRecord) => {
    try {
      console.log('🖨️ Generating RTV summary for:', record.rtv_number)
      
      // Fetch full RTV details including items
      const fullRecord = await rtvApi.getRTVById(params.company, record.rtv_number)
      
      // Group items by article (item_description + sub_category)
      const groupedItems = fullRecord.items.reduce((acc: any, item: any) => {
        const key = `${item.sub_category}|${item.item_description}`
        
        if (!acc[key]) {
          acc[key] = {
            sub_category: item.sub_category,
            item_description: item.item_description,
            boxes: [],
            total_boxes: 0,
            total_net_weight: 0,
            total_gross_weight: 0,
            total_price: 0,
          }
        }
        
        acc[key].boxes.push(item)
        acc[key].total_boxes += 1
        acc[key].total_net_weight += (item.net_weight || 0)
        acc[key].total_gross_weight += (item.gross_weight || 0)
        acc[key].total_price += (item.price || 0)
        
        return acc
      }, {})
      
      const articles = Object.values(groupedItems)
      
      // Create a hidden iframe for printing
      const printWindow = document.createElement('iframe')
      printWindow.style.position = 'fixed'
      printWindow.style.right = '0'
      printWindow.style.bottom = '0'
      printWindow.style.width = '0'
      printWindow.style.height = '0'
      printWindow.style.border = 'none'
      document.body.appendChild(printWindow)
      
      const printDoc = printWindow.contentWindow?.document
      if (!printDoc) return
      
      const getRTVTypeLabel = (type: string): string => {
        const typeLabels: Record<string, string> = {
          quality_issue: "Quality Issue",
          damaged: "Damaged",
          expired: "Expired",
          excess_quantity: "Excess Quantity",
          wrong_item: "Wrong Item",
          other: "Other",
        }
        return typeLabels[type] || type
      }
      
      // Generate HTML content for print
      printDoc.open()
      printDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>RTV Summary - ${record.rtv_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              font-size: 12px;
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .company-name { 
              font-size: 20px; 
              font-weight: bold; 
              margin-bottom: 5px;
            }
            .doc-title { 
              font-size: 16px; 
              font-weight: bold;
              color: #333;
            }
            .info-section { 
              margin: 15px 0;
              border: 1px solid #ddd;
              padding: 10px;
            }
            .info-row { 
              display: flex;
              margin-bottom: 5px;
            }
            .info-label { 
              font-weight: bold; 
              width: 150px;
              color: #555;
            }
            .info-value { 
              flex: 1;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left;
            }
            th { 
              background-color: #f5f5f5; 
              font-weight: bold;
            }
            .total-row {
              font-weight: bold;
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 10px;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">CANDOR FOODS PRIVATE LIMITED</div>
            <div class="doc-title">RETURN TO VENDOR (RTV) SUMMARY</div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <div class="info-label">RTV Number:</div>
              <div class="info-value"><strong>${record.rtv_number}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">Customer Name:</div>
              <div class="info-value">${record.customer_name}</div>
            </div>
            <div class="info-row">
              <div class="info-label">RTV Type:</div>
              <div class="info-value">${getRTVTypeLabel(record.rtv_type)}</div>
            </div>
            <div class="info-row">
              <div class="info-label">RTV Date:</div>
              <div class="info-value">${new Date(record.rtv_date || record.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            ${record.invoice_number ? `
            <div class="info-row">
              <div class="info-label">Invoice Number:</div>
              <div class="info-value">${record.invoice_number}</div>
            </div>` : ''}
            ${record.notes ? `
            <div class="info-row">
              <div class="info-label">Notes:</div>
              <div class="info-value">${record.notes}</div>
            </div>` : ''}
          </div>
          
          <h3 style="margin: 15px 0 10px 0;">Articles Summary (Item-wise)</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">Sr.</th>
                <th>Sub Category</th>
                <th>Item Description</th>
                <th style="text-align: center;">No. of Boxes</th>
                <th style="text-align: right;">Total Net Wt (g)</th>
                <th style="text-align: right;">Total Gross Wt (g)</th>
                <th style="text-align: right;">Total Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${articles.map((article: any, index: number) => `
                <tr>
                  <td style="text-align: center;">${index + 1}</td>
                  <td>${article.sub_category || '-'}</td>
                  <td>${article.item_description || '-'}</td>
                  <td style="text-align: center;"><strong>${article.total_boxes}</strong></td>
                  <td style="text-align: right;">${article.total_net_weight.toLocaleString()}</td>
                  <td style="text-align: right;">${article.total_gross_weight.toLocaleString()}</td>
                  <td style="text-align: right;">₹${article.total_price.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">GRAND TOTAL:</td>
                <td style="text-align: center;"><strong>${record.total_boxes || 0}</strong></td>
                <td style="text-align: right;">${articles.reduce((sum: number, a: any) => sum + a.total_net_weight, 0).toLocaleString()}g</td>
                <td style="text-align: right;">${articles.reduce((sum: number, a: any) => sum + a.total_gross_weight, 0).toLocaleString()}g</td>
                <td style="text-align: right;">₹${(record.total_value || 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="info-section">
            <div class="info-row">
              <div class="info-label">Total Articles:</div>
              <div class="info-value"><strong>${articles.length}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">Total Boxes:</div>
              <div class="info-value"><strong>${record.total_boxes || 0}</strong></div>
            </div>
            <div class="info-row">
              <div class="info-label">Total Value:</div>
              <div class="info-value"><strong>₹${(record.total_value || 0).toLocaleString('en-IN')}</strong></div>
            </div>
          </div>
          
          <div class="footer">
            <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
            <p>This is a system-generated document</p>
          </div>
        </body>
        </html>
      `)
      printDoc.close()
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.contentWindow?.print()
          
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(printWindow)
          }, 100)
        }, 250)
      }
      
      toast({
        title: "Print Preview Ready",
        description: "RTV summary is ready for printing",
      })
    } catch (error) {
      console.error('❌ Error generating print:', error)
      toast({
        title: "Print Failed",
        description: "Failed to generate RTV summary",
        variant: "destructive",
      })
    }
  }

  // Delete RTV
  const handleDeleteRTV = async (record: RTVRecord) => {
    // Confirm delete
    const confirmed = window.confirm(
      `Are you sure you want to delete RTV ${record.rtv_number}?\n\n` +
      `Customer: ${record.customer_name}\n` +
      `Total Boxes: ${record.total_boxes}\n` +
      `Total Value: ₹${(record.total_value || 0).toLocaleString()}\n\n` +
      `This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      console.log('🗑️ Deleting RTV:', record.rtv_number)

      // Call delete API using the service
      await rtvApi.deleteRTV(params.company as Company, record.rtv_number)

      console.log('✅ RTV deleted successfully')

      // Remove from local state
      setRtvRecords(prev => prev.filter(r => r.rtv_number !== record.rtv_number))

      toast({
        title: "✅ RTV Deleted",
        description: `RTV ${record.rtv_number} has been deleted successfully`,
      })
    } catch (error: any) {
      console.error('❌ Error deleting RTV:', error)
      toast({
        title: "❌ Delete Failed",
        description: error.message || "Failed to delete RTV. The endpoint may not be implemented yet.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 sm:h-8 sm:w-8" />
            RTV/Rejection
          </h1>
          <p className="text-muted-foreground mt-1">Return to Vendor & Rejection Management</p>
        </div>
        <Button 
          className="w-full sm:w-auto"
          onClick={() => router.push(`/${params.company}/reordering/create_rtv`)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create RTV
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total RTVs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>RTV Records</CardTitle>
          <CardDescription>View and manage all RTV/Rejection records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by RTV number, vendor name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* RTV Records Table */}
          <div className="border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading RTV records...</span>
              </div>
            ) : error ? (
              <div className="text-center p-8 text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">RTV Number</th>
                      <th className="text-left p-3 font-medium text-sm">Customer</th>
                      <th className="text-left p-3 font-medium text-sm">Type</th>
                      <th className="text-left p-3 font-medium text-sm">Items</th>
                      <th className="text-left p-3 font-medium text-sm">Value</th>
                      <th className="text-left p-3 font-medium text-sm">Date</th>
                      <th className="text-left p-3 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {searchQuery 
                            ? "No RTV records match your search" 
                            : "No RTV records found. Create your first RTV!"}
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => (
                        <tr key={record.rtv_number} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-medium">{record.rtv_number}</div>
                            {record.invoice_number && (
                              <div className="text-xs text-muted-foreground">Invoice: {record.invoice_number}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div>{record.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{record.customer_code}</div>
                          </td>
                          <td className="p-3">{getRTVTypeBadge(record.rtv_type)}</td>
                          <td className="p-3">{record.total_boxes || 0}</td>
                          <td className="p-3 font-medium">₹{(record.total_value || 0).toLocaleString()}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(record.rtv_date || record.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => router.push(`/${params.company}/reordering/${record.rtv_number}`)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handlePrintRTV(record)}
                                title="Print RTV Summary"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteRTV(record)}
                                title="Delete RTV"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
