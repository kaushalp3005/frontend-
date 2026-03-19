"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Debug component to test cold storage transfer flow
 * Add this to your direct transfer form page temporarily
 */
export function DebugColdStorageTransfer({ company }: { company: string }) {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runDebugTests = async () => {
    setLoading(true)
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    }

    try {
      // Test 1: Check cold storage search endpoint
      results.tests.push({ name: "Test 1: Cold Storage Search API", status: "running" })
      const searchUrl = `${process.env.NEXT_PUBLIC_API_URL}/cold-storage/stocks/search?company=${company}&lot_no=&q=MANGO&limit=5`
      const searchRes = await fetch(searchUrl)
      const searchData = await searchRes.json()

      results.tests[0].status = searchRes.ok ? "✅ PASS" : "❌ FAIL"
      results.tests[0].details = {
        url: searchUrl,
        status: searchRes.status,
        resultsCount: searchData.results?.length || 0,
        firstResult: searchData.results?.[0] || null,
        hasBoxId: !!searchData.results?.[0]?.box_id,
        hasTransactionNo: !!searchData.results?.[0]?.transaction_no,
        boxId: searchData.results?.[0]?.box_id || "❌ MISSING",
        transactionNo: searchData.results?.[0]?.transaction_no || "❌ MISSING"
      }

      // Test 2: Check FIFO pick-boxes endpoint (if we have data from test 1)
      if (searchData.results?.[0]) {
        const firstResult = searchData.results[0]
        results.tests.push({ name: "Test 2: FIFO Pick Boxes API", status: "running" })

        const pickUrl = `${process.env.NEXT_PUBLIC_API_URL}/cold-storage/stocks/pick-boxes?company=${company}&item_description=${encodeURIComponent(firstResult.item_description || '')}&lot_no=${encodeURIComponent(firstResult.lot_no || '')}&inward_no=${encodeURIComponent(firstResult.inward_no || '')}&qty=3`

        try {
          const pickRes = await fetch(pickUrl)
          const pickData = await pickRes.json()

          results.tests[1].status = pickRes.ok ? "✅ PASS" : "❌ FAIL"
          results.tests[1].details = {
            url: pickUrl,
            status: pickRes.status,
            boxesReturned: pickData.boxes?.length || 0,
            boxes: pickData.boxes || [],
            allHaveBoxId: pickData.boxes?.every((b: any) => b.box_id) || false,
            allHaveTransactionNo: pickData.boxes?.every((b: any) => b.transaction_no) || false
          }
        } catch (err: any) {
          results.tests[1].status = "❌ ERROR"
          results.tests[1].details = { error: err.message }
        }
      }

      // Test 3: Check cold storage warehouse names
      results.tests.push({
        name: "Test 3: Cold Storage Warehouse Check",
        status: "✅ INFO",
        details: {
          expectedNames: ["Rishi cold", "Savla D-39 cold", "Savla D-514 cold"],
          note: "Transfer must be FROM one of these exact names (case-insensitive) for box_id/transaction_no columns to display in Transfer-IN"
        }
      })

    } catch (error: any) {
      results.error = error.message
    }

    setTestResults(results)
    setLoading(false)
  }

  return (
    <Card className="border-2 border-purple-300 bg-purple-50">
      <CardHeader className="bg-purple-100">
        <CardTitle className="text-purple-900 text-sm flex items-center gap-2">
          🔧 Debug: Cold Storage Transfer Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <Button
          onClick={runDebugTests}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {loading ? "Running Tests..." : "Run Diagnostic Tests"}
        </Button>

        {testResults && (
          <div className="space-y-2 text-xs font-mono">
            <div className="bg-white p-3 rounded border">
              <div className="font-bold mb-2">Test Results:</div>
              {testResults.tests.map((test: any, idx: number) => (
                <div key={idx} className="mb-3 pb-3 border-b last:border-0">
                  <div className="font-semibold text-purple-900">{test.status} {test.name}</div>
                  {test.details && (
                    <pre className="mt-1 text-[10px] bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <details className="bg-white p-3 rounded border">
              <summary className="font-bold cursor-pointer">Full Results (Click to expand)</summary>
              <pre className="mt-2 text-[10px] overflow-x-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
