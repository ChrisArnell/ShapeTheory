import { NextResponse } from 'next/server'
import { getEssays } from '@/lib/essays'

export function GET() {
  const essays = getEssays()
  return NextResponse.json({ essays })
}
