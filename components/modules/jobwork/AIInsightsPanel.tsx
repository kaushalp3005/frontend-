// components/modules/jobwork/AIInsightsPanel.tsx
// TODO: AI Insights — uncomment when ready to enable

// "use client"
//
// import { useState } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Sparkles, RefreshCw, Loader2 } from "lucide-react"
// import type { Company } from "@/types/auth"
// import type { JobworkKPIs, JobworkSummaryRow } from "@/types/jobwork"
//
// const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
//
// interface AIInsightsPanelProps {
//   company: Company
//   kpis: JobworkKPIs | null
//   summaryRows: JobworkSummaryRow[]
// }
//
// export function AIInsightsPanel({ company, kpis, summaryRows }: AIInsightsPanelProps) {
//   const [insights, setInsights] = useState("")
//   const [loading, setLoading] = useState(false)
//
//   const generateInsights = async () => {
//     setLoading(true)
//     setInsights("")
//     try {
//       const summaryData = JSON.stringify({ kpis, summary: summaryRows })
//       const res = await fetch(
//         `${API_URL}/api/ai-insights?company=${company}&summary_json=${encodeURIComponent(summaryData)}`
//       )
//       if (!res.ok) throw new Error("AI insights unavailable")
//       const reader = res.body?.getReader()
//       const decoder = new TextDecoder()
//       if (!reader) return
//
//       while (true) {
//         const { done, value } = await reader.read()
//         if (done) break
//         setInsights(prev => prev + decoder.decode(value))
//       }
//     } catch {
//       setInsights("AI insights temporarily unavailable. Please try again.")
//     } finally {
//       setLoading(false)
//     }
//   }
//
//   return (
//     <Card className="bg-gray-900 text-white border-0">
//       <CardHeader className="pb-3">
//         <div className="flex items-center justify-between">
//           <CardTitle className="text-sm font-semibold flex items-center gap-2">
//             <Sparkles className="h-4 w-4 text-amber-400" /> AI Insights
//           </CardTitle>
//           <Button
//             size="sm" variant="outline"
//             className="h-7 text-xs border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
//             onClick={generateInsights} disabled={loading}
//           >
//             {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
//             {insights ? "Regenerate" : "Generate"}
//           </Button>
//         </div>
//       </CardHeader>
//       {insights && (
//         <CardContent className="pt-0">
//           <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">{insights}</div>
//         </CardContent>
//       )}
//     </Card>
//   )
// }

export {}
