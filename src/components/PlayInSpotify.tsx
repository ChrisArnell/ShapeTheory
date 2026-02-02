'use client'

import { useState, useEffect } from 'react'
import {
  isSpotifyConnected,
  searchAndPlay,
  getDevices,
  SpotifyDevice,
  initiateSpotifyAuth,
} from '@/lib/spotify'

interface PlayInSpotifyProps {
  title: string
  artist?: string
  contentType: 'song' | 'album'
  compact?: boolean
}

export default function PlayInSpotify({ title, artist, contentType, compact = false }: PlayInSpotifyProps) {
  const [connected, setConnected] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [showDeviceSelect, setShowDeviceSelect] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>()

  useEffect(() => {
    const checkConnection = async () => {
      const isConnected = isSpotifyConnected()
      setConnected(isConnected)

      if (isConnected) {
        try {
          const deviceList = await getDevices()
          setDevices(deviceList)
          // Auto-select active device if available
          const active = deviceList.find(d => d.is_active)
          if (active) {
            setSelectedDevice(active.id)
          }
        } catch {
          // Silently fail - will show error when user tries to play
        }
      }
    }

    checkConnection()
  }, [])

  const handlePlay = async (deviceId?: string) => {
    setError(null)
    setSuccess(null)
    setShowDeviceSelect(false)

    // Build search query
    const query = artist ? `${title} ${artist}` : title

    setPlaying(true)
    const result = await searchAndPlay(query, contentType, deviceId || selectedDevice)
    setPlaying(false)

    if (result.success) {
      setSuccess(result.played || 'Playing')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      // Check if it's a no-device error
      if (result.error?.toLowerCase().includes('no active device') ||
          result.error?.toLowerCase().includes('player command failed')) {
        // Refresh devices and show selector
        const deviceList = await getDevices()
        setDevices(deviceList)
        if (deviceList.length > 0) {
          setShowDeviceSelect(true)
        } else {
          setError('No Spotify devices found. Open Spotify in another tab first.')
        }
      } else {
        setError(result.error || 'Failed to play')
      }
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleConnect = async () => {
    try {
      await initiateSpotifyAuth()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Not connected - show connect prompt
  if (!connected) {
    if (compact) {
      return (
        <button
          onClick={handleConnect}
          className="text-xs text-gray-400 hover:text-green-500 transition-colors"
          title="Connect Spotify to play"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </button>
      )
    }
    return null
  }

  // Compact mode - just the play icon
  if (compact) {
    return (
      <div className="relative inline-flex items-center">
        <button
          onClick={() => handlePlay()}
          disabled={playing}
          className={`text-xs transition-colors ${
            playing
              ? 'text-green-500 animate-pulse'
              : success
              ? 'text-green-500'
              : error
              ? 'text-red-500'
              : 'text-gray-400 hover:text-green-500'
          }`}
          title={
            playing
              ? 'Starting playback...'
              : success
              ? success
              : error
              ? error
              : 'Play in Spotify'
          }
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </button>

        {/* Device selector dropdown */}
        {showDeviceSelect && devices.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg z-50 min-w-48">
            <div className="p-2 text-xs text-gray-500 border-b dark:border-gray-700">
              Select device:
            </div>
            {devices.map(device => (
              <button
                key={device.id}
                onClick={() => {
                  setSelectedDevice(device.id)
                  handlePlay(device.id)
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <span>
                  {device.type === 'Computer' && '💻'}
                  {device.type === 'Smartphone' && '📱'}
                  {device.type === 'Speaker' && '🔊'}
                  {!['Computer', 'Smartphone', 'Speaker'].includes(device.type) && '🎵'}
                </span>
                <span>{device.name}</span>
                {device.is_active && (
                  <span className="text-xs text-green-500 ml-auto">active</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowDeviceSelect(false)}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t dark:border-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  // Full mode - button with text
  return (
    <div className="relative">
      <button
        onClick={() => handlePlay()}
        disabled={playing}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
          playing
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
            : success
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
            : error
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
            : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        {playing ? 'Starting...' : success ? 'Playing' : error ? 'Retry' : 'Play'}
      </button>

      {/* Device selector dropdown */}
      {showDeviceSelect && devices.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg z-50 min-w-48">
          <div className="p-2 text-xs text-gray-500 border-b dark:border-gray-700">
            Select a device to play on:
          </div>
          {devices.map(device => (
            <button
              key={device.id}
              onClick={() => {
                setSelectedDevice(device.id)
                handlePlay(device.id)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <span>
                {device.type === 'Computer' && '💻'}
                {device.type === 'Smartphone' && '📱'}
                {device.type === 'Speaker' && '🔊'}
                {!['Computer', 'Smartphone', 'Speaker'].includes(device.type) && '🎵'}
              </span>
              <span>{device.name}</span>
              {device.is_active && (
                <span className="text-xs text-green-500 ml-auto">active</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowDeviceSelect(false)}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t dark:border-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {error && !showDeviceSelect && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
