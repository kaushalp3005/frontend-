// lib/hooks/useBoxManagement.ts
"use client"

import { useCallback, useState } from "react"
import { InwardFormUtils } from "@/lib/utils/inwardFormUtils"

export interface Box {
  id: string
  box_number: number
  article: string
  net_weight: number
  gross_weight: number
  lot_number?: string
}

export interface Article {
  id: string
  item_description: string
  quantity_units: number
  net_weight: number
  total_weight: number
  uom: string
  lot_number?: string
}

export interface BoxManagementState {
  boxes: Box[]
  isGenerating: boolean
  error: string | null
}

export interface BoxStats {
  totalBoxes: number
  totalNetWeight: number
  totalGrossWeight: number
  articleStats: Record<string, {
    boxes: number
    netWeight: number
    grossWeight: number
    articleName: string
  }>
}

/**
 * Hook for comprehensive box management
 */
export function useBoxManagement(initialBoxes: Box[] = []) {
  const [state, setState] = useState<BoxManagementState>({
    boxes: initialBoxes,
    isGenerating: false,
    error: null
  })

  /**
   * Generate boxes from articles
   */
  const generateBoxes = useCallback(async (articles: Article[]) => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }))
    
    try {
      const newBoxes = InwardFormUtils.generateBoxes(articles, state.boxes)
      setState(prev => ({ 
        ...prev, 
        boxes: newBoxes, 
        isGenerating: false 
      }))
      return newBoxes
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate boxes'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isGenerating: false 
      }))
      throw error
    }
  }, [state.boxes])

  /**
   * Add a new box manually
   */
  const addBox = useCallback((boxData: Partial<Box>) => {
    const newBox: Box = {
      id: boxData.id || `box_${Date.now()}`,
      box_number: boxData.box_number || state.boxes.length + 1,
      article: boxData.article || '',
      net_weight: boxData.net_weight || 0,
      gross_weight: boxData.gross_weight || 0,
      lot_number: boxData.lot_number || ''
    }

    setState(prev => ({
      ...prev,
      boxes: [...prev.boxes, newBox],
      error: null
    }))

    return newBox
  }, [state.boxes.length])

  /**
   * Remove a box and optionally decrement article quantity
   */
  const removeBox = useCallback((boxId: string, articles: Article[], decrementArticle: boolean = true) => {
    const boxToRemove = state.boxes.find(box => box.id === boxId)
    if (!boxToRemove) {
      return { boxes: state.boxes, articles }
    }

    let updatedBoxes = state.boxes.filter(box => box.id !== boxId)
    let updatedArticles = articles

    if (decrementArticle) {
      // Find the associated article and decrement its quantity
      updatedArticles = articles.map(article => {
        if (article.item_description === boxToRemove.article) {
          return {
            ...article,
            quantity_units: Math.max(0, article.quantity_units - 1)
          }
        }
        return article
      })
    }

    setState(prev => ({
      ...prev,
      boxes: updatedBoxes,
      error: null
    }))

    return { boxes: updatedBoxes, articles: updatedArticles }
  }, [state.boxes])

  /**
   * Update a box field
   */
  const updateBox = useCallback((boxId: string, field: keyof Box, value: any) => {
    setState(prev => ({
      ...prev,
      boxes: prev.boxes.map(box => 
        box.id === boxId ? { ...box, [field]: value } : box
      ),
      error: null
    }))
  }, [])

  /**
   * Update multiple box fields at once
   */
  const updateBoxFields = useCallback((boxId: string, updates: Partial<Box>) => {
    setState(prev => ({
      ...prev,
      boxes: prev.boxes.map(box => 
        box.id === boxId ? { ...box, ...updates } : box
      ),
      error: null
    }))
  }, [])

  /**
   * Reorder boxes by box number
   */
  const reorderBoxes = useCallback(() => {
    setState(prev => ({
      ...prev,
      boxes: [...prev.boxes].sort((a, b) => a.box_number - b.box_number),
      error: null
    }))
  }, [])

  /**
   * Renumber boxes sequentially
   */
  const renumberBoxes = useCallback(() => {
    setState(prev => ({
      ...prev,
      boxes: prev.boxes.map((box, index) => ({
        ...box,
        box_number: index + 1
      })),
      error: null
    }))
  }, [])

  /**
   * Clear all boxes
   */
  const clearBoxes = useCallback(() => {
    setState(prev => ({
      ...prev,
      boxes: [],
      error: null
    }))
  }, [])

  /**
   * Get box statistics
   */
  const getBoxStats = useCallback((articles: Article[]): BoxStats => {
    const stats: BoxStats = {
      totalBoxes: state.boxes.length,
      totalNetWeight: state.boxes.reduce((sum, box) => sum + box.net_weight, 0),
      totalGrossWeight: state.boxes.reduce((sum, box) => sum + box.gross_weight, 0),
      articleStats: {}
    }

    // Calculate per-article statistics
    state.boxes.forEach((box) => {
      const article = articles.find(art => art.item_description === box.article)
      if (article) {
        const articleId = article.id
        if (!stats.articleStats[articleId]) {
          stats.articleStats[articleId] = {
            boxes: 0,
            netWeight: 0,
            grossWeight: 0,
            articleName: article.item_description || `Article ${articleId}`,
          }
        }
        stats.articleStats[articleId].boxes += 1
        stats.articleStats[articleId].netWeight += box.net_weight
        stats.articleStats[articleId].grossWeight += box.gross_weight
      }
    })

    return stats
  }, [state.boxes])

  /**
   * Validate box totals against article totals
   */
  const validateBoxTotals = useCallback((articles: Article[]) => {
    const boxNetTotal = state.boxes.reduce((sum, box) => sum + box.net_weight, 0)
    const articleNetTotal = articles.reduce((sum, article) => sum + article.net_weight, 0)
    
    const boxGrossTotal = state.boxes.reduce((sum, box) => sum + box.gross_weight, 0)
    const articleGrossTotal = articles.reduce((sum, article) => sum + article.total_weight, 0)

    const netWeightMatch = Math.abs(boxNetTotal - articleNetTotal) < 0.01
    const grossWeightMatch = Math.abs(boxGrossTotal - articleGrossTotal) < 0.01

    return {
      isValid: netWeightMatch && grossWeightMatch,
      netWeightMatch,
      grossWeightMatch,
      boxNetTotal,
      articleNetTotal,
      boxGrossTotal,
      articleGrossTotal
    }
  }, [state.boxes])

  /**
   * Auto-adjust box weights to match article totals
   */
  const autoAdjustBoxWeights = useCallback((articles: Article[]) => {
    const validation = validateBoxTotals(articles)
    if (validation.isValid) {
      return state.boxes // No adjustment needed
    }

    // Calculate adjustment factors
    const netAdjustmentFactor = validation.articleNetTotal / validation.boxNetTotal
    const grossAdjustmentFactor = validation.articleGrossTotal / validation.boxGrossTotal

    const adjustedBoxes = state.boxes.map(box => ({
      ...box,
      net_weight: box.net_weight * netAdjustmentFactor,
      gross_weight: box.gross_weight * grossAdjustmentFactor
    }))

    setState(prev => ({
      ...prev,
      boxes: adjustedBoxes,
      error: null
    }))

    return adjustedBoxes
  }, [state.boxes, validateBoxTotals])

  /**
   * Find boxes by article
   */
  const getBoxesByArticle = useCallback((articleDescription: string) => {
    return state.boxes.filter(box => box.article === articleDescription)
  }, [state.boxes])

  /**
   * Find box by box number
   */
  const getBoxByNumber = useCallback((boxNumber: number) => {
    return state.boxes.find(box => box.box_number === boxNumber)
  }, [state.boxes])

  /**
   * Check if box exists
   */
  const hasBox = useCallback((boxId: string) => {
    return state.boxes.some(box => box.id === boxId)
  }, [state.boxes])

  /**
   * Get next available box number
   */
  const getNextBoxNumber = useCallback(() => {
    if (state.boxes.length === 0) return 1
    const maxNumber = Math.max(...state.boxes.map(box => box.box_number))
    return maxNumber + 1
  }, [state.boxes])

  /**
   * Duplicate a box
   */
  const duplicateBox = useCallback((boxId: string) => {
    const boxToDuplicate = state.boxes.find(box => box.id === boxId)
    if (!boxToDuplicate) return null

    const newBox: Box = {
      ...boxToDuplicate,
      id: `box_${Date.now()}`,
      box_number: getNextBoxNumber()
    }

    setState(prev => ({
      ...prev,
      boxes: [...prev.boxes, newBox],
      error: null
    }))

    return newBox
  }, [state.boxes, getNextBoxNumber])

  /**
   * Move box to different position
   */
  const moveBox = useCallback((boxId: string, newPosition: number) => {
    const boxIndex = state.boxes.findIndex(box => box.id === boxId)
    if (boxIndex === -1) return

    const newBoxes = [...state.boxes]
    const [movedBox] = newBoxes.splice(boxIndex, 1)
    newBoxes.splice(newPosition, 0, movedBox)

    setState(prev => ({
      ...prev,
      boxes: newBoxes,
      error: null
    }))
  }, [state.boxes])

  /**
   * Set error state
   */
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    // State
    boxes: state.boxes,
    isGenerating: state.isGenerating,
    error: state.error,

    // Actions
    generateBoxes,
    addBox,
    removeBox,
    updateBox,
    updateBoxFields,
    reorderBoxes,
    renumberBoxes,
    clearBoxes,
    duplicateBox,
    moveBox,

    // Utilities
    getBoxStats,
    validateBoxTotals,
    autoAdjustBoxWeights,
    getBoxesByArticle,
    getBoxByNumber,
    hasBox,
    getNextBoxNumber,

    // Error handling
    setError,
    clearError
  }
}
