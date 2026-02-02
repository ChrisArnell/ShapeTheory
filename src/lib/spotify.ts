// Spotify Web API integration using PKCE flow for client-side authentication
// This enables controlling playback on existing Spotify sessions (web player, desktop, etc.)

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

// Scopes needed for playback control
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// Storage keys
const TOKEN_KEY = 'spotify_access_token'
const REFRESH_TOKEN_KEY = 'spotify_refresh_token'
const TOKEN_EXPIRY_KEY = 'spotify_token_expiry'
const VERIFIER_KEY = 'spotify_code_verifier'

// Generate random string for PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], '')
}

// Generate code challenge from verifier (PKCE)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return btoa(String.fromCharCode.apply(null, bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number
}

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

// Get the Spotify Client ID from environment
function getClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_SPOTIFY_CLIENT_ID is not configured')
  }
  return clientId
}

// Get redirect URI based on current origin
function getRedirectUri(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/shapemusic/spotify-callback`
}

// Initiate Spotify OAuth flow with PKCE
export async function initiateSpotifyAuth(): Promise<void> {
  const clientId = getClientId()
  const redirectUri = getRedirectUri()

  // Generate PKCE verifier and challenge
  const verifier = generateRandomString(128)
  const challenge = await generateCodeChallenge(verifier)

  // Store verifier for later use in callback
  localStorage.setItem(VERIFIER_KEY, verifier)

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  // Redirect to Spotify
  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  const clientId = getClientId()
  const redirectUri = getRedirectUri()
  const verifier = localStorage.getItem(VERIFIER_KEY)

  if (!verifier) {
    throw new Error('Code verifier not found - auth flow may have been interrupted')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error_description || 'Failed to exchange code for tokens')
  }

  const tokens = await response.json()

  // Store tokens
  storeTokens(tokens)

  // Clean up verifier
  localStorage.removeItem(VERIFIER_KEY)

  return tokens
}

// Store tokens in localStorage
function storeTokens(tokens: { access_token: string; refresh_token?: string; expires_in: number }): void {
  localStorage.setItem(TOKEN_KEY, tokens.access_token)
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
  }
  // Store expiry time (with 5 min buffer)
  const expiryTime = Date.now() + (tokens.expires_in - 300) * 1000
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
}

// Get current access token (refreshing if needed)
export async function getAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

  if (!token) return null

  // Check if token is expired
  if (expiry && Date.now() > parseInt(expiry)) {
    if (refreshToken) {
      try {
        await refreshAccessToken()
        return localStorage.getItem(TOKEN_KEY)
      } catch {
        // Refresh failed, clear tokens
        clearSpotifyAuth()
        return null
      }
    }
    return null
  }

  return token
}

// Refresh the access token
async function refreshAccessToken(): Promise<void> {
  const clientId = getClientId()
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  const tokens = await response.json()
  storeTokens(tokens)
}

// Check if user is connected to Spotify
export function isSpotifyConnected(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}

// Clear Spotify authentication
export function clearSpotifyAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

// Make authenticated API request to Spotify
async function spotifyApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Not authenticated with Spotify')
  }

  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  })

  // Handle 204 No Content (success with no body)
  if (response.status === 204) {
    return {} as T
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
    throw new Error(error.error?.message || 'Spotify API request failed')
  }

  return response.json()
}

// Get available playback devices
export async function getDevices(): Promise<SpotifyDevice[]> {
  const data = await spotifyApi<{ devices: SpotifyDevice[] }>('/me/player/devices')
  return data.devices || []
}

// Get currently playing track
export async function getCurrentPlayback(): Promise<any> {
  try {
    return await spotifyApi('/me/player')
  } catch {
    return null
  }
}

// Search for a track on Spotify
export async function searchTrack(query: string, type: 'track' | 'album' = 'track'): Promise<any> {
  const params = new URLSearchParams({
    q: query,
    type,
    limit: '5',
  })
  return spotifyApi(`/search?${params.toString()}`)
}

// Play a track or album on a specific device (or active device)
export async function playTrack(options: {
  trackUri?: string
  albumUri?: string
  deviceId?: string
}): Promise<void> {
  const { trackUri, albumUri, deviceId } = options

  const body: any = {}

  if (trackUri) {
    body.uris = [trackUri]
  } else if (albumUri) {
    body.context_uri = albumUri
  }

  const params = deviceId ? `?device_id=${deviceId}` : ''

  await spotifyApi(`/me/player/play${params}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

// Search and play - convenience function that searches for content and plays it
export async function searchAndPlay(
  query: string,
  contentType: 'song' | 'album',
  deviceId?: string
): Promise<{ success: boolean; error?: string; played?: string }> {
  try {
    const searchType = contentType === 'song' ? 'track' : 'album'
    const results = await searchTrack(query, searchType)

    if (searchType === 'track' && results.tracks?.items?.length > 0) {
      const track = results.tracks.items[0]
      await playTrack({ trackUri: track.uri, deviceId })
      return { success: true, played: `${track.name} by ${track.artists[0]?.name}` }
    } else if (searchType === 'album' && results.albums?.items?.length > 0) {
      const album = results.albums.items[0]
      await playTrack({ albumUri: album.uri, deviceId })
      return { success: true, played: `${album.name} by ${album.artists[0]?.name}` }
    }

    return { success: false, error: 'No results found on Spotify' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Transfer playback to a specific device
export async function transferPlayback(deviceId: string, play: boolean = false): Promise<void> {
  await spotifyApi('/me/player', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  })
}
