'use client'

import { useState, useEffect } from 'react'
import {
  isSpotifyConnected,
  initiateSpotifyAuth,
  clearSpotifyAuth,
  getDevices,
  SpotifyDevice,
} from '@/lib/spotify'

interface SpotifyConnectProps {
  compact?: boolean
  onConnectionChange?: (connected: boolean) => void
}

export default function SpotifyConnect({ compact = false, onConnectionChange }: SpotifyConnectProps) {
  const [connected, setConnected] = useState(false)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [showDevices, setShowDevices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const isConnected = isSpotifyConnected()
      setConnected(isConnected)

      if (isConnected) {
        try {
          const deviceList = await getDevices()
          setDevices(deviceList)
        } catch (err: any) {
          // Token might be invalid
          if (err.message?.includes('authenticated')) {
            clearSpotifyAuth()
            setConnected(false)
          }
        }
      }

      setLoading(false)
      onConnectionChange?.(isConnected)
    }

    checkConnection()
  }, [onConnectionChange])

  // Refresh devices periodically when connected
  useEffect(() => {
    if (!connected) return

    const refreshDevices = async () => {
      try {
        const deviceList = await getDevices()
        setDevices(deviceList)
        setError(null)
      } catch (err: any) {
        console.error('Failed to refresh devices:', err)
      }
    }

    // Refresh every 30 seconds
    const interval = setInterval(refreshDevices, 30000)
    return () => clearInterval(interval)
  }, [connected])

  const handleConnect = async () => {
    try {
      setError(null)
      await initiateSpotifyAuth()
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Spotify connection')
    }
  }

  const handleDisconnect = () => {
    clearSpotifyAuth()
    setConnected(false)
    setDevices([])
    onConnectionChange?.(false)
  }

  const refreshDevices = async () => {
    try {
      const deviceList = await getDevices()
      setDevices(deviceList)
      setError(null)
    } catch (err: any) {
      setError('Failed to refresh devices')
    }
  }

  if (loading) {
    return compact ? null : (
      <div className="text-sm text-gray-500">Checking Spotify connection...</div>
    )
  }

  // Compact mode - just show connection status
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <span className="w-2 h-2 bg-green-500 rounded-full" title="Spotify connected" />
            <span className="text-xs text-green-600 dark:text-green-400">Spotify</span>
            {devices.length > 0 && (
              <span className="text-xs text-gray-500">
                ({devices.filter(d => d.is_active).length > 0
                  ? devices.find(d => d.is_active)?.name
                  : `${devices.length} device${devices.length !== 1 ? 's' : ''}`})
              </span>
            )}
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="text-xs text-gray-500 hover:text-green-600 dark:hover:text-green-400"
          >
            Connect Spotify
          </button>
        )}
      </div>
    )
  }

  // Full mode - show connection UI and devices
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50/80 dark:bg-gray-800/80">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span className="font-medium">Spotify</span>
          {connected && (
            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              Connected
            </span>
          )}
        </div>

        {connected ? (
          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-500 hover:text-red-500"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="text-xs px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Connect
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-2">{error}</p>
      )}

      {connected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {devices.length === 0
                ? 'No active devices found'
                : `${devices.length} device${devices.length !== 1 ? 's' : ''} available`}
            </span>
            <button
              onClick={refreshDevices}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Refresh
            </button>
          </div>

          {devices.length === 0 ? (
            <p className="text-xs text-gray-500">
              Open Spotify in another tab or on your phone to see it here
            </p>
          ) : (
            <div className="space-y-1">
              {devices.map(device => (
                <div
                  key={device.id}
                  className={`flex items-center gap-2 text-sm p-2 rounded ${
                    device.is_active
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-white dark:bg-gray-700'
                  }`}
                >
                  <span className={device.is_active ? 'text-green-600' : 'text-gray-500'}>
                    {device.type === 'Computer' && '💻'}
                    {device.type === 'Smartphone' && '📱'}
                    {device.type === 'Speaker' && '🔊'}
                    {!['Computer', 'Smartphone', 'Speaker'].includes(device.type) && '🎵'}
                  </span>
                  <span className={device.is_active ? 'font-medium' : ''}>{device.name}</span>
                  {device.is_active && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-auto">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!connected && (
        <p className="text-xs text-gray-500 mt-2">
          Connect Spotify to play recommendations directly from here.
          Open Spotify in another tab first, then click play on any recommendation.
        </p>
      )}
    </div>
  )
}
