'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  saveUserShape,
  loadUserShape,
  getWeightedPredictions,
  getUserHistoryForChat,
  saveUserProfile,
  savePrediction,
  recordOutcome,
  deletePrediction,
  getPendingPredictions,
  getCompletedPredictions,
  getOrCreateAppUser,
  getAppUserId,
  AppType
} from '@/lib/db'
import ShapeRadar from '@/components/ShapeRadar'
import ActivePredictions from '@/components/ActivePredictions'

const APP_TYPE: AppType = 'music'

// Chat session persistence
const CHAT_STORAGE_KEY = 'shapemusic_chat_session'
const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour

interface ChatSession {
  messages: { role: string; content: string }[]
  lastActivity: number
  userId: string
}

interface LocalPrediction {
  id: string
  title: string
  artist?: string
  content_type: string
  hit_probability: number
  ai_probability?: number
  user_initiated?: boolean
  reasoning?: string
  status: 'suggested' | 'locked' | 'completed'
  predicted_at?: string
  dbId?: string
  external_id?: string
  external_source?: string
  year?: number
}

interface CompletedPrediction {
  id: string
  title: string
  content_type: string
  hit_probability: number
  outcome: 'hit' | 'miss' | 'fence'
  completed_at: string
}

// Helper functions for chat session persistence
function saveChatSession(messages: { role: string; content: string }[], userId: string) {
  if (typeof window === 'undefined') return
  const session: ChatSession = {
    messages,
    lastActivity: Date.now(),
    userId
  }
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session))
}

function loadChatSession(userId: string): { role: string; content: string }[] | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!stored) return null

    const session: ChatSession = JSON.parse(stored)

    if (session.userId !== userId) {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      return null
    }

    if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      return null
    }

    return session.messages
  } catch {
    localStorage.removeItem(CHAT_STORAGE_KEY)
    return null
  }
}

function clearChatSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CHAT_STORAGE_KEY)
}

// Auth component inline (music-specific)
function MusicAuth({ onAuth }: { onAuth: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
      onAuth()
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-xl font-semibold mb-4">
        {isSignUp ? 'Create Account' : 'Sign In to Shape Music'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
            required
            minLength={6}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-purple-600 hover:underline"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  )
}

export default function ShapeMusicHome() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [appUserId, setAppUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState('')
  const [shape, setShape] = useState<any>(null)
  const [shapeLoading, setShapeLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')
  const [shapeUpdated, setShapeUpdated] = useState(false)
  const [activePredictions, setActivePredictions] = useState<LocalPrediction[]>([])
  const [completedPredictions, setCompletedPredictions] = useState<CompletedPrediction[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [showAppInfo, setShowAppInfo] = useState(false)
  const [showAbreInfo, setShowAbreInfo] = useState(false)
  const [showWaysToUse, setShowWaysToUse] = useState(false)
  const [readInfoButtons, setReadInfoButtons] = useState<Set<string>>(new Set())
  const [chatSessionRestored, setChatSessionRestored] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Shape animation state
  const [shapeAnimating, setShapeAnimating] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'rising' | 'morphing' | 'holding' | 'falling'>('idle')
  const [changedDimensions, setChangedDimensions] = useState<string[]>([])
  const [displayDimensions, setDisplayDimensions] = useState<Record<string, number> | null>(null)
  const [glowIntensity, setGlowIntensity] = useState(0)

  // Check auth state and get/create music user
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null
    let loadingResolved = false

    // Safety timeout: ensure loading state resolves even if something unexpected happens
    const safetyTimeout = setTimeout(() => {
      if (!loadingResolved) {
        console.warn('Auth check timed out, proceeding in logged-out state')
        setLoading(false)
      }
    }, 3000)

    try {
      supabase.auth.getSession()
        .then(async ({ data: { session } }) => {
          loadingResolved = true
          clearTimeout(safetyTimeout)
          if (session?.user) {
            setAuthUser(session.user)
            // Get or create music-specific user
            console.log('Auth session found, getting app user for:', session.user.id)
            try {
              // Add timeout to prevent hanging
              const musicUserIdPromise = getOrCreateAppUser(session.user.id, APP_TYPE)
              const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Setup timed out')), 10000)
              )
              const musicUserId = await Promise.race([musicUserIdPromise, timeoutPromise])
              console.log('Got musicUserId:', musicUserId)
              if (musicUserId) {
                // Set shapeLoading BEFORE setAppUserId to prevent flash of new user screen
                setShapeLoading(true)
                setAppUserId(musicUserId)
                setSetupError(null)
              } else {
                console.error('getOrCreateAppUser returned null')
                setSetupError('Failed to connect to database. Please try again.')
              }
            } catch (err) {
              console.error('Failed to get/create app user:', err)
              setSetupError('Failed to connect to database. Please try again.')
            }
          }
          setLoading(false)
        })
        .catch((error) => {
          loadingResolved = true
          clearTimeout(safetyTimeout)
          console.error('Failed to get auth session:', error)
          setLoading(false) // Allow app to render in logged-out state
        })

      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setAuthUser(session.user)
          try {
            const musicUserIdPromise = getOrCreateAppUser(session.user.id, APP_TYPE)
            const timeoutPromise = new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Setup timed out')), 10000)
            )
            const musicUserId = await Promise.race([musicUserIdPromise, timeoutPromise])
            if (musicUserId) {
              // Set shapeLoading BEFORE setAppUserId to prevent flash of new user screen
              setShapeLoading(true)
              setAppUserId(musicUserId)
              setSetupError(null)
            } else {
              setSetupError('Failed to connect to database. Please try again.')
            }
          } catch (err) {
            console.error('Failed to get/create app user on auth change:', err)
            setSetupError('Failed to connect to database. Please try again.')
          }
        } else {
          setAuthUser(null)
          setAppUserId(null)
          setSetupError(null)
        }
      })
      subscription = data.subscription
    } catch (error) {
      loadingResolved = true
      clearTimeout(safetyTimeout)
      console.error('Supabase client initialization failed:', error)
      setLoading(false) // Allow app to render in logged-out state
    }

    return () => {
      clearTimeout(safetyTimeout)
      subscription?.unsubscribe()
    }
  }, [])

  // Load read info buttons from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shapemusic_read_info')
      if (stored) {
        setReadInfoButtons(new Set(JSON.parse(stored)))
      }
    }
  }, [])

  const markInfoRead = (key: string) => {
    setReadInfoButtons(prev => {
      const newSet = new Set(prev)
      newSet.add(key)
      localStorage.setItem('shapemusic_read_info', JSON.stringify(Array.from(newSet)))
      return newSet
    })
  }

  // Load existing shape when app user is ready
  useEffect(() => {
    if (appUserId) {
      loadExistingShape()
    }
  }, [appUserId])

  // Persist chat messages to localStorage
  useEffect(() => {
    if (appUserId && chatMessages.length > 0 && chatSessionRestored) {
      saveChatSession(chatMessages, appUserId)
    }
  }, [chatMessages, appUserId, chatSessionRestored])

  // Shape animation
  const animateShapeUpdate = useCallback(async (
    oldDimensions: Record<string, number>,
    newDimensions: Record<string, number>,
    changed: string[]
  ) => {
    setShapeAnimating(true)
    setChangedDimensions(changed)
    setDisplayDimensions(oldDimensions)

    setAnimationPhase('rising')
    const glowSteps = 20
    for (let i = 0; i <= glowSteps; i++) {
      await new Promise(r => setTimeout(r, 40))
      setGlowIntensity(i / glowSteps)
    }

    setAnimationPhase('morphing')
    const morphSteps = 30
    for (let i = 0; i <= morphSteps; i++) {
      const t = i / morphSteps
      const interpolated: Record<string, number> = {}
      for (const key of Object.keys(newDimensions)) {
        const oldVal = oldDimensions[key] || 5
        const newVal = newDimensions[key]
        interpolated[key] = oldVal + (newVal - oldVal) * t
      }
      setDisplayDimensions(interpolated)
      await new Promise(r => setTimeout(r, 20))
    }

    setAnimationPhase('holding')
    await new Promise(r => setTimeout(r, 800))

    setAnimationPhase('falling')
    for (let i = glowSteps; i >= 0; i--) {
      await new Promise(r => setTimeout(r, 40))
      setGlowIntensity(i / glowSteps)
    }
    await new Promise(r => setTimeout(r, 800))

    setAnimationPhase('idle')
    setShapeAnimating(false)
    setChangedDimensions([])
    setDisplayDimensions(null)
  }, [])

  const loadExistingShape = async () => {
    if (!appUserId) {
      setShapeLoading(false)
      return
    }

    try {
      const existingShape = await loadUserShape(appUserId, APP_TYPE)
      if (existingShape && Object.keys(existingShape).length > 0) {
        setShape({ dimensions: existingShape, summary: 'Welcome back!' })

        const storedMessages = loadChatSession(appUserId)
        if (storedMessages && storedMessages.length > 0) {
          setChatMessages(storedMessages)
        } else {
          setChatMessages([{
            role: 'assistant',
            content: "Hey! Abre here. Good to see you again. Looking for something to listen to? Or want to refine your music shape? Tell me what you've been into lately, or ask for recommendations."
          }])
        }
        setChatSessionRestored(true)

        // Load existing pending predictions
        const pending = await getPendingPredictions(appUserId, APP_TYPE)
        if (pending && pending.length > 0) {
          setActivePredictions(pending.map((p: any) => ({
            id: p.id,
            dbId: p.id,
            title: p.content?.title || 'Unknown',
            content_type: p.content?.content_type || 'album',
            hit_probability: p.predicted_enjoyment,
            status: 'locked' as const,
            predicted_at: p.predicted_at
          })))
        }

        // Load completed predictions
        const completed = await getCompletedPredictions(appUserId, APP_TYPE)
        if (completed && completed.length > 0) {
          setCompletedPredictions(completed.map((p: any) => {
            let outcome: 'hit' | 'miss' | 'fence' = 'fence'
            if (p.actual_enjoyment >= 8) outcome = 'hit'
            else if (p.actual_enjoyment <= 2) outcome = 'miss'
            return {
              id: p.id,
              title: p.content?.title || 'Unknown',
              content_type: p.content?.content_type || 'album',
              hit_probability: p.predicted_enjoyment,
              outcome,
              completed_at: p.completed_at
            }
          }))
        }
      }
    } finally {
      setShapeLoading(false)
    }
  }

  const retrySetup = async () => {
    if (!authUser) {
      console.error('Cannot retry setup: no auth user')
      return
    }
    setSetupError(null)
    try {
      const musicUserIdPromise = getOrCreateAppUser(authUser.id, APP_TYPE)
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Setup timed out')), 10000)
      )
      const musicUserId = await Promise.race([musicUserIdPromise, timeoutPromise])
      if (musicUserId) {
        setAppUserId(musicUserId)
      } else {
        setSetupError('Failed to connect to database. Please try again.')
      }
    } catch (err) {
      console.error('Retry setup failed:', err)
      setSetupError('Failed to connect to database. Please try again.')
    }
  }

  const captureShape = async () => {
    if (!favorites.trim()) {
      console.error('Cannot capture shape: no favorites entered')
      return
    }
    if (!appUserId) {
      console.error('Cannot capture shape: appUserId is null - user may not be fully authenticated')
      return
    }
    setShapeLoading(true)

    try {
      const res = await fetch('/api/shapemusic/shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites })
      })
      const data = await res.json()

      const saved = await saveUserShape(appUserId, data.dimensions, APP_TYPE)
      if (saved) {
        console.log('Music shape saved to database')
      }

      setShape(data)
      setChatMessages([{ role: 'assistant', content: data.summary }])
      setChatSessionRestored(true)
    } catch (err) {
      console.error('Error capturing shape:', err)
    }

    setShapeLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || !shape || !appUserId) return

    const newMessages = [...chatMessages, { role: 'user', content: input }]
    setChatMessages(newMessages)
    setInput('')
    setShapeLoading(true)

    try {
      const [shapebaseData, userHistory] = await Promise.all([
        getWeightedPredictions(shape.dimensions, 8.0, 15, APP_TYPE),
        getUserHistoryForChat(appUserId, APP_TYPE)
      ])

      const res = await fetch('/api/shapemusic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          shape: shape.dimensions,
          shapebaseData,
          userHistory
        })
      })
      const data = await res.json()

      if (data.shapeUpdates && data.shapeUpdates.updates) {
        const oldDimensions = { ...shape.dimensions }
        const newDimensions = { ...shape.dimensions, ...data.shapeUpdates.updates }
        const changedKeys = Object.keys(data.shapeUpdates.updates)

        const saved = await saveUserShape(appUserId, newDimensions, APP_TYPE)
        if (saved) {
          setShape({ ...shape, dimensions: newDimensions })
          setShapeUpdated(true)
          setTimeout(() => setShapeUpdated(false), 3000)
          animateShapeUpdate(oldDimensions, newDimensions, changedKeys)
        }
      }

      if (data.nameUpdate || data.moodUpdate) {
        await saveUserProfile(appUserId, {
          ...(data.nameUpdate && { display_name: data.nameUpdate }),
          ...(data.moodUpdate && { current_mood: data.moodUpdate })
        }, APP_TYPE)
      }

      if (data.newPredictions && data.newPredictions.length > 0) {
        const newPreds: LocalPrediction[] = data.newPredictions.map((pred: any, idx: number) => ({
          id: `suggested-${Date.now()}-${idx}`,
          title: pred.title,
          artist: pred.artist,
          content_type: pred.content_type,
          hit_probability: pred.hit_probability,
          ai_probability: pred.ai_probability,
          user_initiated: pred.user_initiated,
          reasoning: pred.reasoning,
          status: 'suggested' as const
        }))
        setActivePredictions(prev => [...prev, ...newPreds])
      }

      setChatMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      console.error('Error sending message:', err)
    }

    setShapeLoading(false)
  }

  const handleSignOut = async () => {
    clearChatSession()
    await supabase.auth.signOut()
    setShape(null)
    setChatMessages([])
    setFavorites('')
    setActivePredictions([])
    setAppUserId(null)
  }

  const startNewConversation = () => {
    clearChatSession()
    setChatMessages([{
      role: 'assistant',
      content: "Fresh start! What can I help you with? Looking for music recommendations, want to refine your shape, or just want to chat about what you've been listening to?"
    }])
  }

  const handleLockIn = async (prediction: LocalPrediction) => {
    if (!appUserId || !shape) return

    // Look up canonical content info from MusicBrainz
    let externalId: string | undefined
    let externalSource: string | undefined
    let year: number | undefined
    // Format title with artist for display (e.g., "Stranger in the Alps - Phoebe Bridgers")
    let canonicalTitle = prediction.artist
      ? `${prediction.title} - ${prediction.artist}`
      : prediction.title

    try {
      // Build search query including artist for more accurate matching
      const searchQuery = prediction.artist
        ? `${prediction.title} ${prediction.artist}`
        : prediction.title

      const lookupRes = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          content_type: prediction.content_type,
          artist: prediction.artist // Pass artist for validation
        })
      })
      const lookupData = await lookupRes.json()

      if (lookupData.results && lookupData.results.length > 0) {
        // If artist was specified, try to find a result that matches the artist
        let match = lookupData.results[0]
        if (prediction.artist) {
          const artistLower = prediction.artist.toLowerCase()
          const artistMatch = lookupData.results.find((r: any) =>
            r.metadata?.artist?.toLowerCase().includes(artistLower) ||
            r.title?.toLowerCase().includes(artistLower)
          )
          if (artistMatch) {
            match = artistMatch
          }
        }
        externalId = match.external_id
        externalSource = match.external_source
        year = match.year
        canonicalTitle = match.title
      }
    } catch (err) {
      console.error('Content lookup failed, saving with title only:', err)
    }

    const dbId = await savePrediction(
      appUserId,
      canonicalTitle,
      prediction.content_type,
      prediction.hit_probability,
      shape.dimensions,
      undefined,
      externalId,
      externalSource,
      year,
      prediction.ai_probability,
      APP_TYPE
    )

    if (dbId) {
      setActivePredictions(prev =>
        prev.map(p =>
          p.id === prediction.id
            ? { ...p, title: canonicalTitle, artist: prediction.artist, status: 'locked' as const, dbId, external_id: externalId, external_source: externalSource, year }
            : p
        )
      )
    }
  }

  const handleDismiss = (predictionId: string) => {
    setActivePredictions(prev => prev.filter(p => p.id !== predictionId))
  }

  const handleRecordOutcome = async (predictionId: string, outcome: 'hit' | 'miss' | 'fence') => {
    const prediction = activePredictions.find(p => p.id === predictionId)
    if (!prediction?.dbId) return

    const outcomeValue = outcome === 'hit' ? 10 : outcome === 'fence' ? 5 : 0
    const success = await recordOutcome(prediction.dbId, outcomeValue)

    if (success) {
      setCompletedPredictions(prev => [{
        id: prediction.dbId!,
        title: prediction.title,
        content_type: prediction.content_type,
        hit_probability: prediction.hit_probability,
        outcome,
        completed_at: new Date().toISOString()
      }, ...prev])

      setActivePredictions(prev => prev.filter(p => p.id !== predictionId))

      if (outcome !== 'fence' && shape && appUserId) {
        const wasHit = outcome === 'hit'
        const outcomeMessage = `[PREDICTION OUTCOME: "${prediction.title}" - predicted ${prediction.hit_probability}%, result: ${wasHit ? 'HIT' : 'MISS'}. Keep it brief (1-2 sentences). ${wasHit ? 'Quick acknowledgment, maybe mention ONE dimension that fits.' : 'Brief, warm response. Ask what didn\'t land.'} Don't be over the top.]`

        const newMessages = [...chatMessages, { role: 'user', content: outcomeMessage }]

        try {
          const [shapebaseData, userHistory] = await Promise.all([
            getWeightedPredictions(shape.dimensions, 8.0, 15, APP_TYPE),
            getUserHistoryForChat(appUserId, APP_TYPE)
          ])

          const res = await fetch('/api/shapemusic/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: newMessages,
              shape: shape.dimensions,
              shapebaseData,
              userHistory
            })
          })
          const data = await res.json()

          if (data.response) {
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
          }
        } catch (err) {
          console.error('Error getting Abre comment:', err)
        }
      }
    }
  }

  const handleDeletePrediction = async (predictionId: string) => {
    const prediction = activePredictions.find(p => p.id === predictionId)

    // If it's locked in the database, delete it there first
    if (prediction?.dbId) {
      const deleted = await deletePrediction(prediction.dbId)
      if (!deleted) {
        // Database deletion failed - don't remove from local state
        // This prevents the prediction from "popping back" on refresh
        console.error('Failed to delete prediction from database')
        return
      }
    }

    // Only remove from local state after successful database deletion
    setActivePredictions(prev => prev.filter(p => p.id !== predictionId))
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-2xl mx-auto">
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto relative">
      {/* Giant faint shape in background */}
      {shape && shape.dimensions && (
        <motion.div
          className={`fixed inset-0 flex items-center justify-center pointer-events-none ${
            animationPhase === 'idle' ? 'z-0' : 'z-50'
          }`}
          initial={{ opacity: 0.12, scale: 1 }}
          animate={{
            opacity: animationPhase === 'idle' || animationPhase === 'falling' ? 0.12 : 0.7,
            scale: animationPhase === 'idle' || animationPhase === 'falling' ? 1 : 1.15,
          }}
          transition={{
            duration: animationPhase === 'rising' ? 0.8 : animationPhase === 'falling' ? 0.8 : 0.3,
            ease: animationPhase === 'rising' ? 'easeOut' : 'easeInOut'
          }}
        >
          <ShapeRadar
            dimensions={displayDimensions || shape.dimensions}
            size={800}
            highlightedDimensions={changedDimensions}
            glowIntensity={glowIntensity}
          />
        </motion.div>
      )}

      <motion.div
        className="relative z-10"
        animate={{
          opacity: animationPhase === 'idle' ? 1 : 0.15,
        }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-4">
            {shape && shape.dimensions && (
              <div className={`transition-all duration-500 ${shapeUpdated ? 'scale-110' : ''}`}>
                <ShapeRadar dimensions={shape.dimensions} size={150} />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">Shape Music</h1>
              <p className="text-gray-600 dark:text-gray-400">
                A Shape Theory App
              </p>
            </div>
          </div>
          {authUser && (
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Sign out
            </button>
          )}
        </div>

        {authUser && (
          <div className="flex items-center gap-4 mb-8">
            <p className="text-sm text-gray-500">{authUser.email}</p>
            <button
              onClick={() => { setShowAppInfo(true); markInfoRead('appInfo') }}
              className={`text-xs px-2 py-1 border rounded ${
                readInfoButtons.has('appInfo')
                  ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
              }`}
            >
              What is this?
            </button>
            <button
              onClick={() => { setShowAbreInfo(true); markInfoRead('abreInfo') }}
              className={`text-xs px-2 py-1 border rounded ${
                readInfoButtons.has('abreInfo')
                  ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
              }`}
            >
              Who is Abre?
            </button>
            {shape && (
              <button
                onClick={() => { setShowWaysToUse(true); markInfoRead('waysToUse') }}
                className={`text-xs px-2 py-1 border rounded ${
                  readInfoButtons.has('waysToUse')
                    ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                    : 'border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                }`}
              >
                Ways to use
              </button>
            )}
          </div>
        )}

        {/* App Info Popup */}
        {showAppInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAppInfo(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">What is Shape Music?</h2>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  Shape Music maps your music preferences across 10 dimensions - not genres, but <em>how</em> you experience music.
                </p>
                <p>
                  Things like your need for energy, appreciation for complexity, preference for lyrical depth, and openness to experimentation.
                </p>
                <p>
                  Your "music shape" predicts what you'll enjoy better than genre labels ever could. A folk album and an electronic track might share more DNA than two rock albums.
                </p>
                <p>
                  As you rate music and refine your shape, we learn from listeners with similar shapes to make better predictions - closing the loop between recommendation and outcome.
                </p>
              </div>
              <button
                onClick={() => setShowAppInfo(false)}
                className="mt-4 w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Abre Info Popup */}
        {showAbreInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAbreInfo(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">Who is Abre?</h2>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  <strong>Abre</strong> (AH-bray) is your guide through Shape Music. The name means "opens" in Spanish and Portuguese - and as an imperative, it's a gentle command: <em>open</em>.
                </p>
                <p>
                  That's what Abre is here to do: open you to music you didn't know you needed, open connections between you and listeners who share your taste, and open your understanding of why certain sounds just work for you.
                </p>
                <p>
                  Abre is warm but direct, curious about patterns, and genuinely invested in getting music recommendations right for you. She'll ask questions, propose shape adjustments, and always be honest when something's a tricky call.
                </p>
              </div>
              <button
                onClick={() => setShowAbreInfo(false)}
                className="mt-4 w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Ways to Use Popup */}
        {showWaysToUse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowWaysToUse(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">Ways to Use Shape Music</h2>
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Ask for recommendations</h3>
                  <p className="text-gray-500 dark:text-gray-400 italic mb-1">"What should I listen to?" or "I need something chill"</p>
                  <p>Abre will suggest music based on your shape and current mood. She'll give you a mix of high and low probability matches - the misses help define your edges.</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Take a dimension quiz</h3>
                  <p className="text-gray-500 dark:text-gray-400 italic mb-1">"Quiz me on complexity" or "I want to explore my energy preference"</p>
                  <p>Abre will ask you targeted questions to refine specific dimensions of your music shape.</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Lock in predictions</h3>
                  <p className="text-gray-500 dark:text-gray-400 italic mb-1">"Lock that in" or "Add it to my list"</p>
                  <p>When Abre recommends something you're going to listen to, lock it in. After you listen, report back - this closes the loop and helps us learn.</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Make your own predictions</h3>
                  <p className="text-gray-500 dark:text-gray-400 italic mb-1">"I'm about to listen to Kid A and I think 80% it hits"</p>
                  <p>You can predict your own enjoyment before listening. Abre will also give her prediction - now you're both on record.</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Share what you loved or hated</h3>
                  <p className="text-gray-500 dark:text-gray-400 italic mb-1">"I just finished listening to In Rainbows and it was incredible"</p>
                  <p>Strong reactions help refine your shape. Abre may propose adjustments based on patterns she notices.</p>
                </div>

              </div>
              <button
                onClick={() => setShowWaysToUse(false)}
                className="mt-4 w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {!authUser ? (
          <MusicAuth onAuth={() => {}} />
        ) : !shape ? (
          <div className="space-y-4">
            {/* Abre intro for new users */}
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                Hey there! I'm <strong>Abre</strong>. Welcome to Shape Music. I'm going to help you discover your music shape - a multi-dimensional profile of how you experience music. Not what genres you like, but <em>how</em> you like music. Your need for complexity, your preference for raw vs polished production, your appetite for experimentation... that kind of thing.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-3">
                To get started, just tell me some music you love. Artists, albums, songs - anything. The more variety, the better I can see your shape.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                List some favorite music - artists, albums, songs, anything:
              </label>
              <textarea
                value={favorites}
                onChange={(e) => setFavorites(e.target.value)}
                className="w-full h-32 p-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700"
                placeholder="e.g., Radiohead, Frank Ocean's Blonde, Kendrick Lamar, that one Bon Iver song..."
              />
            </div>
            {setupError ? (
              <div className="space-y-2">
                <p className="text-red-600 dark:text-red-400 text-sm">{setupError}</p>
                <button
                  onClick={retrySetup}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Retry Setup
                </button>
              </div>
            ) : (
              <button
                onClick={captureShape}
                disabled={shapeLoading || !favorites.trim() || !appUserId}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shapeLoading ? 'Analyzing...' : !appUserId ? 'Setting up...' : 'Capture My Music Shape'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chat Interface */}
            <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="h-72 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-purple-100 dark:bg-purple-900 ml-8'
                        : 'bg-gray-100 dark:bg-gray-800 mr-8'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
                {shapeLoading && (
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mr-8">
                    Thinking...
                  </div>
                )}
              </div>
              <div className="border-t dark:border-gray-700 p-3 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask for recommendations, share what you're listening to..."
                  className="flex-1 p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
                />
                <button
                  onClick={sendMessage}
                  disabled={shapeLoading || !input.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Send
                </button>
                <button
                  onClick={startNewConversation}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                  title="Start fresh conversation"
                >
                  New
                </button>
              </div>

              {/* Active Predictions Strip */}
              <ActivePredictions
                predictions={activePredictions}
                onLockIn={handleLockIn}
                onDismiss={handleDismiss}
                onRecordOutcome={handleRecordOutcome}
                onDelete={handleDeletePrediction}
              />
            </div>

            {/* Prediction History */}
            {completedPredictions.length > 0 && (
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="w-full px-4 py-3 flex justify-between items-center bg-gray-50/90 dark:bg-gray-800/90 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium">
                    Prediction History ({completedPredictions.length})
                  </span>
                  <span className="text-gray-500">
                    {historyExpanded ? '?' : '?'}
                  </span>
                </button>

                {historyExpanded && (
                  <div className="bg-white/90 dark:bg-gray-900/90">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left">Title</th>
                            <th className="px-4 py-2 text-center">Type</th>
                            <th className="px-4 py-2 text-center">Prob</th>
                            <th className="px-4 py-2 text-center">Outcome</th>
                            <th className="px-4 py-2 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedPredictions.map((pred) => (
                            <tr key={pred.id} className="border-t dark:border-gray-700">
                              <td className="px-4 py-2">{pred.title}</td>
                              <td className="px-4 py-2 text-center text-gray-500 capitalize text-xs">
                                {pred.content_type.replace('_', ' ')}
                              </td>
                              <td className="px-4 py-2 text-center">{pred.hit_probability}%</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  pred.outcome === 'hit'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : pred.outcome === 'miss'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}>
                                  {pred.outcome === 'hit' ? 'Hit' : pred.outcome === 'miss' ? 'Miss' : '~ Fence'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-gray-500 text-xs">
                                {new Date(pred.completed_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Calibration Summary */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 text-sm">
                      {(() => {
                        const total = completedPredictions.length
                        const hits = completedPredictions.filter(p => p.outcome === 'hit').length
                        const fences = completedPredictions.filter(p => p.outcome === 'fence').length
                        const effectiveHits = hits + (fences * 0.5)
                        const actualHitRate = total > 0
                          ? Math.round((effectiveHits / total) * 100)
                          : 0

                        if (total === 0) {
                          return <span className="text-gray-500">No outcomes yet</span>
                        }

                        // Exponential decay weighting (half-life of 10 predictions)
                        // More recent predictions are weighted more heavily
                        const HALF_LIFE = 10
                        const DECAY = Math.pow(0.5, 1 / HALF_LIFE) // ~0.933

                        // Sort by completion date, most recent first
                        const sorted = [...completedPredictions].sort(
                          (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
                        )

                        let weightedPredSum = 0
                        let weightedActualSum = 0
                        let totalWeight = 0

                        sorted.forEach((pred, i) => {
                          const weight = Math.pow(DECAY, i)
                          weightedPredSum += weight * pred.hit_probability
                          const actualValue = pred.outcome === 'hit' ? 100 : pred.outcome === 'fence' ? 50 : 0
                          weightedActualSum += weight * actualValue
                          totalWeight += weight
                        })

                        const weightedAvgPrediction = Math.round(weightedPredSum / totalWeight)
                        const weightedActualRate = Math.round(weightedActualSum / totalWeight)

                        // Need at least 10 predictions to assess calibration
                        const canAssessCalibration = total >= 10
                        const calibrationDiff = weightedAvgPrediction - weightedActualRate

                        return (
                          <div className="space-y-1">
                            <div>
                              <strong>{effectiveHits}/{total}</strong> hits ({actualHitRate}% hit rate)
                            </div>
                            <div className="text-xs text-gray-500">
                              Avg prediction: {weightedAvgPrediction}% - Actual: {weightedActualRate}%
                              {canAssessCalibration && (
                                Math.abs(calibrationDiff) <= 10
                                  ? ' - Well calibrated!'
                                  : calibrationDiff > 0
                                  ? ' - Predictions running hot'
                                  : ' - Predictions running cold'
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shape Bars Display */}
            <div className={`p-4 rounded-lg transition-colors duration-300 ${
              shapeUpdated
                ? 'bg-purple-100 dark:bg-purple-900 ring-2 ring-purple-500'
                : 'bg-gray-100/80 dark:bg-gray-800/80'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold">Your Music Shape</h2>
                {shapeUpdated && (
                  <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded">
                    Updated!
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {shape.dimensions && Object.entries(shape.dimensions).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-sm w-40 capitalize">{key.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded">
                      <div
                        className="h-full bg-purple-600 rounded"
                        style={{ width: `${(value / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm w-6 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </main>
  )
}
