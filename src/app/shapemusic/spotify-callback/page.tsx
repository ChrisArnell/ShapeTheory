'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exchangeCodeForTokens } from '@/lib/spotify'

function SpotifyCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        setStatus('error')
        setError(errorParam === 'access_denied'
          ? 'Spotify access was denied'
          : `Spotify error: ${errorParam}`)
        return
      }

      if (!code) {
        setStatus('error')
        setError('No authorization code received')
        return
      }

      try {
        await exchangeCodeForTokens(code)
        setStatus('success')
        // Redirect back to main page after brief success message
        setTimeout(() => {
          router.push('/shapemusic')
        }, 1500)
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'Failed to connect to Spotify')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="max-w-md w-full text-center">
      {status === 'processing' && (
        <div className="space-y-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg">Connecting to Spotify...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg text-green-600 dark:text-green-400">Spotify connected!</p>
          <p className="text-sm text-gray-500">Returning to Shape Music...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-lg text-red-600 dark:text-red-400">Connection failed</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => router.push('/shapemusic')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Return to Shape Music
          </button>
        </div>
      )}
    </div>
  )
}

export default function SpotifyCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Suspense fallback={
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg">Connecting to Spotify...</p>
        </div>
      }>
        <SpotifyCallbackContent />
      </Suspense>
    </main>
  )
}
