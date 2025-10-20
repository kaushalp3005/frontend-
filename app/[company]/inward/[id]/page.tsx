"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { ArrowLeft, Download, Printer, QrCode, Edit, Loader2, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { getInwardDetail, convertToLegacyRecord, type Company, type InwardDetailResponse } from "@/types/inward"

interface InwardDetailPageProps {
  params: {
    company: Company
    id: string
  }
}

export default function InwardDetailPage({ params }: InwardDetailPageProps) {
  const { company, id } = params
  
  // State management
  const [data, setData] = useState<InwardDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printingBoxes, setPrintingBoxes] = useState<Set<number>>(new Set())

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getInwardDetail(company, id)
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch inward record")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [company, id])

  const generateAndPrintLabel = async (box: any, article: any) => {
    try {
      // Dynamically import QR utilities and React QRCode component
      const { generateSimplifiedQRData } = await import('@/lib/utils/qr')
      const QRCode = (await import('qrcode')).default

      // Prepare QR payload
      const qrPayload = {
        company: company,
        entry_date: data!.transaction.entry_date,
        vendor_name: data!.transaction.vendor_supplier_name || '',
        customer_name: data!.transaction.customer_party_name || '',
        item_description: article.item_description,
        net_weight: box.net_weight || 0,
        total_weight: box.gross_weight || 0,
        batch_number: article.batch_number || '',
        box_number: box.box_number,
        manufacturing_date: article.manufacturing_date,
        expiry_date: article.expiry_date,
        transaction_no: data!.transaction.transaction_no,
        sku_id: article.sku_id || 0,
        approval_authority: data!.transaction.approval_authority
      }

      // Generate QR data string
      const qrDataString = generateSimplifiedQRData(qrPayload)

      // Generate QR code as Data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: 'M'
      })

      // Format dates
      const formatDate = (dateString?: string) => {
        if (!dateString) return ''
        try {
          return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          })
        } catch {
          return ''
        }
      }

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.style.visibility = 'hidden'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentWindow?.document
      if (iframeDoc) {
        iframeDoc.open()
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title></title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: Arial, sans-serif;
                  background: white;
                }
                .label-container {
                  width: 4in;
                  height: 2in;
                  background: white;
                  border: 1px solid #000;
                  display: flex;
                }
                .qr-section {
                  width: 2in;
                  height: 2in;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0.1in;
                }
                .qr-section img {
                  width: 1.7in;
                  height: 1.7in;
                }
                .info-section {
                  width: 2in;
                  height: 2in;
                  padding: 0.08in;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  font-size: 8pt;
                  line-height: 1.1;
                  overflow: hidden;
                }
                .company-info {
                  font-weight: bold;
                  font-size: 9pt;
                  margin-bottom: 0.02in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .transaction-info {
                  font-size: 7pt;
                  font-family: monospace;
                  margin-bottom: 0.03in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .item-description {
                  font-weight: bold;
                  font-size: 7.5pt;
                  line-height: 1.1;
                  max-height: 0.5in;
                  overflow: hidden;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  word-wrap: break-word;
                  word-break: break-word;
                  margin-bottom: 0.03in;
                }
                .details {
                  font-size: 7.5pt;
                  line-height: 1.15;
                  flex: 1;
                  overflow: hidden;
                }
                .details-row {
                  margin-bottom: 0.01in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .batch-info {
                  font-size: 7pt;
                  font-family: monospace;
                  margin-bottom: 0.01in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 1.84in;
                  display: block;
                }
                .exp-date {
                  color: #d00;
                  font-weight: bold;
                }

                @media print {
                  @page {
                    size: 4in 2in;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: white;
                  }
                  .label-container {
                    width: 4in;
                    height: 2in;
                    border: 1px solid #000;
                    page-break-after: avoid;
                    page-break-inside: avoid;
                  }
                }
                @page { margin: 0; }
                html { margin: 0; }
                body { margin: 0; }
              </style>
              <style>
                @page { margin: 0mm; }
                @page :first { margin: 0mm; }
                @page :left { margin: 0mm; }
                @page :right { margin: 0mm; }
              </style>
            </head>
            <body>
              <div class="label-container">
                <div class="qr-section">
                  <img src="${qrCodeDataURL}" alt="QR Code" />
                </div>
                <div class="info-section">
                  <div>
                    <div class="company-info">${qrPayload.company}</div>
                    <div class="transaction-info">${qrPayload.transaction_no}</div>
                  </div>
                  <div class="item-description">${qrPayload.item_description}</div>
                  <div class="details">
                    <div class="details-row">
                      <span>Box #${qrPayload.box_number}</span>
                    </div>
                    <div class="details-row">
                      <span>Net Wt: ${qrPayload.net_weight}kg</span>
                    </div>
                    <div class="details-row">
                      <span>Gross Wt: ${qrPayload.total_weight}kg</span>
                    </div>
                    <div class="details-row">
                      <span>Entry: ${formatDate(qrPayload.entry_date)}</span>
                    </div>
                    ${qrPayload.expiry_date ? `
                    <div class="details-row exp-date">
                      <span>Exp: ${formatDate(qrPayload.expiry_date)}</span>
                    </div>
                    ` : ''}
                    ${qrPayload.batch_number ? `
                    <div class="batch-info">Batch: ${qrPayload.batch_number.length > 20 ? qrPayload.batch_number.substring(0, 20) + '...' : qrPayload.batch_number}</div>
                    ` : ''}
                  </div>
                  <div></div>
                </div>
              </div>
              <script>
                // Auto-trigger browser print dialog
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                    // Close iframe after printing or canceling
                    window.onafterprint = function() {
                      window.parent.postMessage('print-complete', '*');
                    };
                  }, 300);
                };
              </script>
            </body>
          </html>
        `)
        iframeDoc.close()

        // Listen for print completion to remove iframe
        const handleMessage = (event: MessageEvent) => {
          if (event.data === 'print-complete') {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }
        window.addEventListener('message', handleMessage)

        // Fallback cleanup after 30 seconds
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }, 30000)
      }

      return true
    } catch (err) {
      console.error("Error generating label:", err)
      throw err
    }
  }

  const handlePrintBox = async (box: any) => {
    try {
      setPrintingBoxes(prev => new Set(prev).add(box.box_number))

      console.log("Printing box:", box)

      if (!data) {
        alert("Error: No data available")
        return
      }

      // Find the article for this box
      const article = data.articles.find(a => a.item_description === box.article_description) || data.articles[0]
      if (!article) {
        throw new Error(`Article not found for box ${box.box_number}`)
      }

      // Generate and print the label using the new method
      await generateAndPrintLabel(box, article)

    } catch (error) {
      console.error("Error processing box print:", error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to process box print'}`)
    } finally {
      setPrintingBoxes(prev => {
        const newSet = new Set(prev)
        newSet.delete(box.box_number)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Loading inward record...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
        <div className="text-center py-12">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Record Not Found</h1>
          <p className="text-gray-600 mb-6">The requested inward record with ID "{id}" could not be found.</p>
          <Button asChild>
            <Link href={`/${company}/inward`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inward List
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const { transaction, articles, boxes } = data

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${company}/inward`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Back to List</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Inward Record Details</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View inward transaction details</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          <Link href={`/${company}/inward/${id}/edit`}>
            <Button variant="outline" className="flex-1 sm:flex-none">
              <Edit className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Edit Record</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          </Link>
          <Button variant="outline" className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Download</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        {/* Main Details */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          {/* System Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  <p className="bg-muted p-2 rounded">{data.company}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transaction Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.transaction_no}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entry Date</p>
                  <p className="bg-muted p-2 rounded">
                    {transaction.entry_date ? format(new Date(transaction.entry_date), "MMM dd, yyyy") : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">System GRN Date</p>
                  <p className="bg-muted p-2 rounded">{transaction.system_grn_date || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transport Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Transport Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vehicle Number *</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.vehicle_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transporter Name *</p>
                  <p className="bg-muted p-2 rounded">{transaction.transporter_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">LR Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.lr_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Source Location</p>
                  <p className="bg-muted p-2 rounded">{transaction.source_location || "-"}</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Destination Location</p>
                  <p className="bg-muted p-2 rounded">{transaction.destination_location || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Party Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Party Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vendor/Supplier Name *</p>
                  <p className="bg-muted p-2 rounded">{transaction.vendor_supplier_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer/Party Name *</p>
                  <p className="bg-muted p-2 rounded">{transaction.customer_party_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Purchase By *</p>
                  <p className="bg-muted p-2 rounded">{transaction.purchase_by || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approval Authority *</p>
                  <p className="bg-muted p-2 rounded">{transaction.approval_authority || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Challan Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.challan_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.invoice_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PO Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.po_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">GRN Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.grn_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">GRN Quantity</p>
                  <p className="bg-muted p-2 rounded">{transaction.grn_quantity || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Received Quantity</p>
                  <p className="bg-muted p-2 rounded">{transaction.received_quantity || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Note Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.dn_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Service Invoice Number</p>
                  <p className="bg-muted p-2 rounded font-mono">{transaction.service_invoice_number || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remarks Section */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">General Remarks</p>
                <p className="bg-muted p-2 rounded min-h-[100px]">{transaction.remark || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Articles Section - Now supports multiple articles */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Articles ({articles.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {articles.map((article, index) => (
                <div key={article.id || index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Article {index + 1}</h4>
                    {article.sku_id && (
                      <Badge variant="outline" className="text-xs">
                        SKU: {article.sku_id}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Item Category *</p>
                      <p className="bg-muted p-2 rounded">{article.item_category || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Sub Category *</p>
                      <p className="bg-muted p-2 rounded">{article.sub_category || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Item Description *</p>
                      <p className="bg-muted p-2 rounded">{article.item_description || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Quantity Units *</p>
                      <p className="bg-muted p-2 rounded">{article.quantity_units || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pack size ( weights )</p>
                      <p className="bg-muted p-2 rounded">{article.packaging_type || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">UOM *</p>
                      <p className="bg-muted p-2 rounded">{article.uom || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Net Weight *</p>
                      <p className="bg-muted p-2 rounded">{article.net_weight ? `${article.net_weight} kg` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Gross Weight *</p>
                      <p className="bg-muted p-2 rounded">{article.total_weight ? `${article.total_weight} kg` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Batch Number</p>
                      <p className="bg-muted p-2 rounded font-mono">{article.batch_number || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Lot Number</p>
                      <p className="bg-muted p-2 rounded font-mono">{article.lot_number || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Manufacturing Date</p>
                      <p className="bg-muted p-2 rounded">{article.manufacturing_date || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expiry Date</p>
                      <p className="bg-muted p-2 rounded">{article.expiry_date || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Import Date</p>
                      <p className="bg-muted p-2 rounded">{article.import_date || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unit Rate</p>
                      <p className="bg-muted p-2 rounded">₹{article.unit_rate?.toLocaleString() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                      <p className="bg-muted p-2 rounded">₹{article.total_amount?.toLocaleString() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tax Amount</p>
                      <p className="bg-muted p-2 rounded">₹{article.tax_amount?.toLocaleString() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Discount Amount</p>
                      <p className="bg-muted p-2 rounded">₹{article.discount_amount?.toLocaleString() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Currency</p>
                      <p className="bg-muted p-2 rounded">{article.currency || "-"}</p>
                    </div>
                  </div>
                </div>
              ))}
              {articles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No articles found for this transaction.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Box Management - Now properly grouped by articles */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Box Management ({boxes.length} boxes)</CardTitle>
            </CardHeader>
            <CardContent>
              {boxes && boxes.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-lg">Per-Article Summary</h4>
                    <div className="grid gap-4">
                      {articles.map((article, index) => {
                        const articleBoxes = boxes.filter(box => box.article_description === article.item_description)
                        return (
                          <div key={article.id || index} className="p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-sm">{article.item_description || `Article ${index + 1}`}</h5>
                              <Badge variant="outline">{articleBoxes.length} boxes</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Total Net Weight:</span>
                                <span className="ml-2 font-medium">
                                  {articleBoxes.reduce((sum, box) => sum + (box.net_weight || 0), 0).toFixed(2)} kg
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Total Gross Weight:</span>
                                <span className="ml-2 font-medium">
                                  {articleBoxes.reduce((sum, box) => sum + (box.gross_weight || 0), 0).toFixed(2)} kg
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <div className="min-w-[600px] px-2 sm:px-0">
                      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Box Number</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Article Name</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Lot Number</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Net Weight (kg)</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Gross Weight (kg)</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
                        <tbody>
                          {boxes.map((box, index) => (
                            <tr key={`${box.transaction_no}-${box.article_description}-${box.box_number}`} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                  <span className="font-medium text-sm">{box.box_number}</span>
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm font-medium">{box.article_description}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm">{box.lot_number || "-"}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm">{box.net_weight?.toFixed(2) || "-"}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm">{box.gross_weight?.toFixed(2) || "-"}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintBox(box)}
                                  disabled={printingBoxes.has(box.box_number)}
                                  className="flex items-center gap-2"
                                >
                                  {printingBoxes.has(box.box_number) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Printer className="w-4 h-4" />
                                  )}
                                  Print
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Boxes</p>
                      <p className="text-2xl font-bold text-blue-900">{boxes.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Net Weight</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + (box.net_weight || 0), 0).toFixed(2)} kg
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Gross Weight</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + (box.gross_weight || 0), 0).toFixed(2)} kg
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No boxes available for this record.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Quick Box Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {boxes && boxes.slice(0, 5).map((box, index) => (
                  <div key={`${box.transaction_no}-${box.article_description}-${box.box_number}`} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div>
                      <span className="font-medium">Box {box.box_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{box.net_weight || 0}kg</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintBox(box)}
                        disabled={printingBoxes.has(box.box_number)}
                        className="h-6 px-2"
                      >
                        {printingBoxes.has(box.box_number) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Printer className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                {boxes && boxes.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">+{boxes.length - 5} more boxes</p>
                )}
                {(!boxes || boxes.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center">No boxes generated</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Articles:</span>
                <span className="font-medium">{articles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Quantity:</span>
                <span className="font-medium">
                  {articles.reduce((sum, article) => sum + (article.quantity_units || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Boxes:</span>
                <span className="font-medium">{boxes?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Amount:</span>
                <span className="font-bold">
                  ₹{(transaction.total_amount || articles.reduce((sum, article) => sum + (article.total_amount || 0), 0)).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/${company}/inward/${id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Record
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}
