import { NextResponse } from 'next/server'
import { getEssays } from '@/lib/essays'

export async function GET() {
  try {
    const essays = await getEssays()
    return NextResponse.json({ essays })
  } catch (error: any) {
    console.error('Failed to fetch essays:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch essays' },
      { status: 500 }
    )
  }
}
