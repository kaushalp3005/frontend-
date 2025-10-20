// components/modules/inward/ArticleManagement.tsx
"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Plus, 
  Trash2, 
  Package, 
  Scale, 
  DollarSign, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react"
import { useItemCategories, useSubCategories, useItemDescriptions } from "@/lib/hooks/useDropdownData"
import { InwardFormUtils } from "@/lib/utils/inwardFormUtils"
import type { Company } from "@/types/inward"
import type { ArticleData } from "@/lib/validations/inwardForm"

interface ArticleManagementProps {
  articles: ArticleData[]
  onAddArticle: () => void
  onRemoveArticle: (id: string) => void
  onUpdateArticle: (id: string, field: keyof ArticleData, value: any) => void
  company: Company
  errors?: Record<string, string>
}

export function ArticleManagement({
  articles,
  onAddArticle,
  onRemoveArticle,
  onUpdateArticle,
  company,
  errors = {}
}: ArticleManagementProps) {
  const [skuResolutionStatus, setSkuResolutionStatus] = useState<Record<string, 'idle' | 'resolving' | 'resolved' | 'error'>>({})
  const [skuErrors, setSkuErrors] = useState<Record<string, string>>({})

  // Dropdown hooks
  const { options: categoryOptions, loading: categoryLoading } = useItemCategories({ company })
  const { options: subCategoryOptions, loading: subCategoryLoading } = useSubCategories(articles[0]?.item_category, { company })
  const { options: itemDescriptionOptions, loading: itemDescriptionLoading } = useItemDescriptions({ 
    company, 
    item_category: articles[0]?.item_category,
    sub_category: articles[0]?.sub_category 
  })

  // Auto-resolve SKU ID when item description changes
  useEffect(() => {
    articles.forEach(async (article) => {
      if (article.item_description && article.item_category && article.sub_category && !article.sku_id) {
        setSkuResolutionStatus(prev => ({ ...prev, [article.id]: 'resolving' }))
        
        try {
          const skuId = await InwardFormUtils.resolveSkuId(article, company)
          onUpdateArticle(article.id, 'sku_id', skuId)
          setSkuResolutionStatus(prev => ({ ...prev, [article.id]: 'resolved' }))
          setSkuErrors(prev => ({ ...prev, [article.id]: '' }))
        } catch (error) {
          console.error(`Error resolving SKU for article ${article.id}:`, error)
          setSkuResolutionStatus(prev => ({ ...prev, [article.id]: 'error' }))
          setSkuErrors(prev => ({ 
            ...prev, 
            [article.id]: error instanceof Error ? error.message : 'Failed to resolve SKU ID' 
          }))
        }
      }
    })
  }, [articles, company, onUpdateArticle])

  const handleArticleChange = (articleId: string, field: keyof ArticleData, value: any) => {
    onUpdateArticle(articleId, field, value)
    
    // Reset SKU resolution status when key fields change
    if (field === 'item_category' || field === 'sub_category' || field === 'item_description') {
      setSkuResolutionStatus(prev => ({ ...prev, [articleId]: 'idle' }))
      setSkuErrors(prev => ({ ...prev, [articleId]: '' }))
    }
  }

  const getSkuStatusIcon = (articleId: string) => {
    const status = skuResolutionStatus[articleId]
    switch (status) {
      case 'resolving':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getSkuStatusText = (articleId: string) => {
    const status = skuResolutionStatus[articleId]
    switch (status) {
      case 'resolving':
        return 'Resolving SKU...'
      case 'resolved':
        return 'SKU resolved'
      case 'error':
        return skuErrors[articleId] || 'SKU resolution failed'
      default:
        return 'SKU will be resolved automatically'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Article Management
        </h3>
        <Button onClick={onAddArticle} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Article
        </Button>
      </div>

      {articles.map((article, index) => (
        <Card key={article.id} className={errors[article.id] ? 'border-red-200' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Article {index + 1}</CardTitle>
              <div className="flex items-center gap-2">
                {getSkuStatusIcon(article.id)}
                <span className="text-sm text-muted-foreground">
                  {getSkuStatusText(article.id)}
                </span>
                {articles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveArticle(article.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SKU ID Display */}
            {article.sku_id && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  SKU ID: {article.sku_id}
                </span>
              </div>
            )}

            {/* SKU Error Display */}
            {skuErrors[article.id] && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {skuErrors[article.id]}
                </AlertDescription>
              </Alert>
            )}

            {/* Item Category */}
            <div className="space-y-2">
              <Label htmlFor={`category-${article.id}`}>Item Category *</Label>
              <Select
                value={article.item_category}
                onValueChange={(value) => handleArticleChange(article.id, 'item_category', value)}
                disabled={categoryLoading}
              >
                <SelectTrigger id={`category-${article.id}`}>
                  <SelectValue placeholder={categoryLoading ? "Loading categories..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option: { value: string; label: string; id?: number }) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Category */}
            <div className="space-y-2">
              <Label htmlFor={`subcategory-${article.id}`}>Sub Category *</Label>
              <Select
                value={article.sub_category}
                onValueChange={(value) => handleArticleChange(article.id, 'sub_category', value)}
                disabled={subCategoryLoading || !article.item_category}
              >
                <SelectTrigger id={`subcategory-${article.id}`}>
                  <SelectValue placeholder={subCategoryLoading ? "Loading subcategories..." : "Select subcategory"} />
                </SelectTrigger>
                <SelectContent>
                  {subCategoryOptions.map((option: { value: string; label: string; id?: number }) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Description */}
            <div className="space-y-2">
              <Label htmlFor={`description-${article.id}`}>Item Description *</Label>
              <Select
                value={article.item_description}
                onValueChange={(value) => handleArticleChange(article.id, 'item_description', value)}
                disabled={itemDescriptionLoading || !article.sub_category}
              >
                <SelectTrigger id={`description-${article.id}`}>
                  <SelectValue placeholder={itemDescriptionLoading ? "Loading descriptions..." : "Select item description"} />
                </SelectTrigger>
                <SelectContent>
                  {itemDescriptionOptions.map((option: { value: string; label: string; id?: number }) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity Units */}
              <div className="space-y-2">
                <Label htmlFor={`quantity-${article.id}`}>Quantity Units *</Label>
                <Input
                  id={`quantity-${article.id}`}
                  type="number"
                  value={article.quantity_units}
                  onChange={(e) => handleArticleChange(article.id, 'quantity_units', Number(e.target.value))}
                  min="1"
                />
              </div>

              {/* UOM */}
              <div className="space-y-2">
                <Label htmlFor={`uom-${article.id}`}>UOM *</Label>
                <Select
                  value={article.uom}
                  onValueChange={(value) => handleArticleChange(article.id, 'uom', value)}
                >
                  <SelectTrigger id={`uom-${article.id}`}>
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOX">BOX</SelectItem>
                    <SelectItem value="CARTON">CARTON</SelectItem>
                    <SelectItem value="PIECE">PIECE</SelectItem>
                    <SelectItem value="BAG">BAG</SelectItem>
                    <SelectItem value="LITER">LITER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Net Weight */}
              <div className="space-y-2">
                <Label htmlFor={`netweight-${article.id}`}>Net Weight (kg) *</Label>
                <Input
                  id={`netweight-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.net_weight}
                  onChange={(e) => handleArticleChange(article.id, 'net_weight', Number(e.target.value))}
                  min="0.01"
                />
              </div>

              {/* Total Weight */}
              <div className="space-y-2">
                <Label htmlFor={`totalweight-${article.id}`}>Total Weight (kg) *</Label>
                <Input
                  id={`totalweight-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.total_weight}
                  onChange={(e) => handleArticleChange(article.id, 'total_weight', Number(e.target.value))}
                  min="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Unit Rate */}
              <div className="space-y-2">
                <Label htmlFor={`unitrate-${article.id}`}>Unit Rate *</Label>
                <Input
                  id={`unitrate-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.unit_rate}
                  onChange={(e) => handleArticleChange(article.id, 'unit_rate', Number(e.target.value))}
                  min="0.01"
                />
              </div>

              {/* Total Amount */}
              <div className="space-y-2">
                <Label htmlFor={`totalamount-${article.id}`}>Total Amount</Label>
                <Input
                  id={`totalamount-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.total_amount}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tax Amount */}
              <div className="space-y-2">
                <Label htmlFor={`taxamount-${article.id}`}>Tax Amount</Label>
                <Input
                  id={`taxamount-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.tax_amount}
                  onChange={(e) => handleArticleChange(article.id, 'tax_amount', Number(e.target.value))}
                  min="0"
                />
              </div>

              {/* Discount Amount */}
              <div className="space-y-2">
                <Label htmlFor={`discountamount-${article.id}`}>Discount Amount</Label>
                <Input
                  id={`discountamount-${article.id}`}
                  type="number"
                  step="0.01"
                  value={article.discount_amount}
                  onChange={(e) => handleArticleChange(article.id, 'discount_amount', Number(e.target.value))}
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Manufacturing Date */}
              <div className="space-y-2">
                <Label htmlFor={`mfgdate-${article.id}`}>Manufacturing Date</Label>
                <Input
                  id={`mfgdate-${article.id}`}
                  type="date"
                  value={article.manufacturing_date}
                  onChange={(e) => handleArticleChange(article.id, 'manufacturing_date', e.target.value)}
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor={`expdate-${article.id}`}>Expiry Date</Label>
                <Input
                  id={`expdate-${article.id}`}
                  type="date"
                  value={article.expiry_date}
                  onChange={(e) => handleArticleChange(article.id, 'expiry_date', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Batch Number */}
              <div className="space-y-2">
                <Label htmlFor={`batchnumber-${article.id}`}>Batch Number *</Label>
                <Input
                  id={`batchnumber-${article.id}`}
                  value={article.batch_number}
                  onChange={(e) => handleArticleChange(article.id, 'batch_number', e.target.value)}
                />
              </div>

              {/* Lot Number */}
              <div className="space-y-2">
                <Label htmlFor={`lotnumber-${article.id}`}>Lot Number</Label>
                <Input
                  id={`lotnumber-${article.id}`}
                  value={article.lot_number}
                  onChange={(e) => handleArticleChange(article.id, 'lot_number', e.target.value)}
                />
              </div>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor={`currency-${article.id}`}>Currency *</Label>
              <Select
                value={article.currency}
                onValueChange={(value) => handleArticleChange(article.id, 'currency', value)}
              >
                <SelectTrigger id={`currency-${article.id}`}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
