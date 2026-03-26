import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming JSON data
    const data = await request.json()
    
    console.log('Received inward data:', data)
    
    // Validate required fields
    if (!data.company) {
      return NextResponse.json(
        { error: 'Company is required' },
        { status: 400 }
      )
    }
    
    if (!data.transaction) {
      return NextResponse.json(
        { error: 'Transaction data is required' },
        { status: 400 }
      )
    }
    
    if (!data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
      return NextResponse.json(
        { error: 'At least one article is required' },
        { status: 400 }
      )
    }
    
    if (!data.boxes || !Array.isArray(data.boxes)) {
      return NextResponse.json(
        { error: 'Boxes data is required' },
        { status: 400 }
      )
    }
    
    // TODO: Here you would typically:
    // 1. Save transaction to database
    // 2. Save articles to database
    // 3. Save boxes to database
    // 4. Generate any required IDs or references
    // 5. Send notifications if needed
    
    // For now, we'll just log the data and return success
    console.log('Transaction:', data.transaction)
    console.log('Articles:', data.articles)
    console.log('Boxes:', data.boxes)
    
    // Simulate database save delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Inward entry saved successfully',
      data: {
        transaction_id: `TXN-${Date.now()}`,
        saved_at: new Date().toISOString(),
        company: data.company,
        transaction_count: 1,
        article_count: data.articles.length,
        box_count: data.boxes.length
      }
    })
    
  } catch (error) {
    console.error('Error processing inward entry:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
