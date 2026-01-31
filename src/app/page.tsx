'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/shapemusic')
  }, [router])

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <p>Redirecting to Shape Music...</p>
    </main>
  )
}
