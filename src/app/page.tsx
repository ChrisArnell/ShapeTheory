'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { saveUserShape, loadUserShape, getWeightedPredictions, getUserHistoryForChat, saveUserProfile, savePrediction, recordOutcome, getPendingPredictions, getCompletedPredictions } from '@/lib/db'
import Auth from '@/components/Auth'
import ShapeRadar from '@/components/ShapeRadar'
import ActivePredictions from '@/components/ActivePredictions'

// Chat session persistence
const CHAT_STORAGE_KEY = 'shapetheory_chat_session'
const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour

interface ChatSession {
  messages: { role: string; content: string }[]
  lastActivity: number
  userId: string
}

interface LocalPrediction {
  id: string
  title: string
  content_type: string
  hit_probability: number
  reasoning?: string
  status: 'suggested' | 'locked' | 'completed'
  predicted_at?: string
  dbId?: string  // database ID once locked in
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

    // Check if session is for this user
    if (session.userId !== userId) {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      return null
    }

    // Check if session has expired (1 hour)
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

export default function Home() {
  const [user, setUser] = useState<any>(null)
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
  const [chatSessionRestored, setChatSessionRestored] = useState(false)

  // Shape animation state
  const [shapeAnimating, setShapeAnimating] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'rising' | 'morphing' | 'holding' | 'falling'>('idle')
  const [changedDimensions, setChangedDimensions] = useState<string[]>([])
  const [displayDimensions, setDisplayDimensions] = useState<Record<string, number> | null>(null)
  const [glowIntensity, setGlowIntensity] = useState(0)

  // Check auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load existing shape when user logs in
  useEffect(() => {
    if (user) {
      loadExistingShape()
    }
  }, [user])

  // Persist chat messages to localStorage whenever they change
  useEffect(() => {
    if (user && chatMessages.length > 0 && chatSessionRestored) {
      saveChatSession(chatMessages, user.id)
    }
  }, [chatMessages, user, chatSessionRestored])

  // Animate shape update - "level up" effect
  const animateShapeUpdate = useCallback(async (
    oldDimensions: Record<string, number>,
    newDimensions: Record<string, number>,
    changed: string[]
  ) => {
    console.log('🎬 Starting shape animation', { changed, oldDimensions, newDimensions })

    setShapeAnimating(true)
    setChangedDimensions(changed)
    setDisplayDimensions(oldDimensions)

    // Phase 1: Rise up - shape comes forward with glow (0.8s)
    setAnimationPhase('rising')

    // Animate glow intensity up
    const glowSteps = 20
    for (let i = 0; i <= glowSteps; i++) {
      await new Promise(r => setTimeout(r, 40))
      setGlowIntensity(i / glowSteps)
    }

    // Phase 2: Morph the shape values (0.6s)
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

    // Phase 3: Hold with full glow (0.8s)
    setAnimationPhase('holding')
    await new Promise(r => setTimeout(r, 800))

    // Phase 4: Fade back (0.8s)
    setAnimationPhase('falling')

    // Animate glow intensity down
    for (let i = glowSteps; i >= 0; i--) {
      await new Promise(r => setTimeout(r, 40))
      setGlowIntensity(i / glowSteps)
    }

    // Wait for fade animation to complete
    await new Promise(r => setTimeout(r, 800))

    // Cleanup
    setAnimationPhase('idle')
    setShapeAnimating(false)
    setChangedDimensions([])
    setDisplayDimensions(null)
    console.log('🎬 Animation complete')
  }, [])

  const loadExistingShape = async () => {
    if (!user) return

    const existingShape = await loadUserShape(user.id)
    if (existingShape && Object.keys(existingShape).length > 0) {
      setShape({ dimensions: existingShape, summary: 'Welcome back!' })

      // Try to restore chat from localStorage first
      const storedMessages = loadChatSession(user.id)
      if (storedMessages && storedMessages.length > 0) {
        setChatMessages(storedMessages)
      } else {
        // Fresh session - use default welcome
        setChatMessages([{
          role: 'assistant',
          content: "Hey! Abre here. Good to see you again. Looking for something to watch or listen to? Or want to work more on your shape? I can run a quick quiz on any dimension that feels off, or you can tell me more things you love or hate and we'll keep refining."
        }])
      }
      setChatSessionRestored(true)

      // Load existing pending predictions
      const pending = await getPendingPredictions(user.id)
      if (pending && pending.length > 0) {
        setActivePredictions(pending.map((p: any) => ({
          id: p.id,
          dbId: p.id,
          title: p.content?.title || 'Unknown',
          content_type: p.content?.content_type || 'other',
          hit_probability: p.predicted_enjoyment, // stored as probability 0-100
          status: 'locked' as const,
          predicted_at: p.predicted_at
        })))
      }

      // Load completed predictions for history
      const completed = await getCompletedPredictions(user.id)
      if (completed && completed.length > 0) {
        setCompletedPredictions(completed.map((p: any) => {
          // Map actual_enjoyment to outcome: 10=hit, 0=miss, 5=fence
          let outcome: 'hit' | 'miss' | 'fence' = 'fence'
          if (p.actual_enjoyment >= 8) outcome = 'hit'
          else if (p.actual_enjoyment <= 2) outcome = 'miss'
          return {
            id: p.id,
            title: p.content?.title || 'Unknown',
            content_type: p.content?.content_type || 'other',
            hit_probability: p.predicted_enjoyment,
            outcome,
            completed_at: p.completed_at
          }
        }))
      }
    }
  }

  const captureShape = async () => {
    if (!favorites.trim() || !user) return
    setShapeLoading(true)
    
    try {
      const res = await fetch('/api/shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites })
      })
      const data = await res.json()
      
      // Save to database
      const saved = await saveUserShape(user.id, data.dimensions)
      if (saved) {
        console.log('Shape saved to database')
      }
      
      setShape(data)
      setChatMessages([{ role: 'assistant', content: data.summary }])
    } catch (err) {
      console.error('Error capturing shape:', err)
    }
    
    setShapeLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || !shape) return

    const newMessages = [...chatMessages, { role: 'user', content: input }]
    setChatMessages(newMessages)
    setInput('')
    setShapeLoading(true)

    try {
      // Fetch evidence from similar users (shapebase) and user history
      const [shapebaseData, userHistory] = await Promise.all([
        getWeightedPredictions(shape.dimensions, 8.0, 15),
        getUserHistoryForChat(user.id)
      ])

      const res = await fetch('/api/chat', {
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

      // If Abre updated the shape, save it and trigger animation
      if (data.shapeUpdates && data.shapeUpdates.updates) {
        const oldDimensions = { ...shape.dimensions }
        const newDimensions = { ...shape.dimensions, ...data.shapeUpdates.updates }
        const changedKeys = Object.keys(data.shapeUpdates.updates)

        const saved = await saveUserShape(user.id, newDimensions)
        if (saved) {
          setShape({ ...shape, dimensions: newDimensions })
          setShapeUpdated(true)
          setTimeout(() => setShapeUpdated(false), 3000)

          // Trigger the level-up animation
          animateShapeUpdate(oldDimensions, newDimensions, changedKeys)
        }
      }

      // If Abre saved name or mood, persist it
      if (data.nameUpdate || data.moodUpdate) {
        await saveUserProfile(user.id, {
          ...(data.nameUpdate && { display_name: data.nameUpdate }),
          ...(data.moodUpdate && { current_mood: data.moodUpdate })
        })
      }

      // If Abre created predictions, add them to suggestions
      if (data.newPredictions && data.newPredictions.length > 0) {
        const newPreds: LocalPrediction[] = data.newPredictions.map((pred: any, idx: number) => ({
          id: `suggested-${Date.now()}-${idx}`,
          title: pred.title,
          content_type: pred.content_type,
          hit_probability: pred.hit_probability,
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
  }

  // Start a new conversation (clear chat but keep shape)
  const startNewConversation = () => {
    clearChatSession()
    setChatMessages([{
      role: 'assistant',
      content: "Fresh start! What can I help you with? Looking for recommendations, want to refine your shape, or just want to chat about what you've been watching lately?"
    }])
  }

  // Lock in a suggested prediction - save to database with canonical content lookup
  const handleLockIn = async (prediction: LocalPrediction) => {
    if (!user || !shape) return

    // Look up canonical content info from TMDB/MusicBrainz
    let externalId: string | undefined
    let externalSource: string | undefined
    let year: number | undefined
    let canonicalTitle = prediction.title

    try {
      const lookupRes = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: prediction.title,
          content_type: prediction.content_type
        })
      })
      const lookupData = await lookupRes.json()

      if (lookupData.results && lookupData.results.length > 0) {
        // Take the first/best match
        const match = lookupData.results[0]
        externalId = match.external_id
        externalSource = match.external_source
        year = match.year
        canonicalTitle = match.title // Use canonical title from API
      }
    } catch (err) {
      console.error('Content lookup failed, saving with title only:', err)
    }

    // Store hit_probability in predicted_enjoyment field (0-100)
    const dbId = await savePrediction(
      user.id,
      canonicalTitle,
      prediction.content_type,
      prediction.hit_probability,
      shape.dimensions,
      undefined, // mood_before
      externalId,
      externalSource,
      year
    )

    if (dbId) {
      setActivePredictions(prev =>
        prev.map(p =>
          p.id === prediction.id
            ? { ...p, title: canonicalTitle, status: 'locked' as const, dbId, external_id: externalId, external_source: externalSource, year }
            : p
        )
      )
    }
  }

  // Dismiss a suggested prediction (don't save)
  const handleDismiss = (predictionId: string) => {
    setActivePredictions(prev => prev.filter(p => p.id !== predictionId))
  }

  // Record outcome for a locked prediction
  const handleRecordOutcome = async (predictionId: string, outcome: 'hit' | 'miss' | 'fence') => {
    const prediction = activePredictions.find(p => p.id === predictionId)
    if (!prediction?.dbId) return

    // Map outcome to number for database: hit=10, fence=5, miss=0
    const outcomeValue = outcome === 'hit' ? 10 : outcome === 'fence' ? 5 : 0
    const success = await recordOutcome(prediction.dbId, outcomeValue)

    if (success) {
      // Add to completed predictions
      setCompletedPredictions(prev => [{
        id: prediction.dbId!,
        title: prediction.title,
        content_type: prediction.content_type,
        hit_probability: prediction.hit_probability,
        outcome,
        completed_at: new Date().toISOString()
      }, ...prev])

      // Remove from active
      setActivePredictions(prev => prev.filter(p => p.id !== predictionId))

      // Ask Abre to comment on the result (skip for fence - it's ambiguous)
      if (outcome !== 'fence') {
        const wasHit = outcome === 'hit'
        const outcomeMessage = `[PREDICTION OUTCOME: User just finished "${prediction.title}". You predicted ${prediction.hit_probability}% chance it would hit. Result: ${wasHit ? 'HIT - it landed!' : 'MISS - didn\'t work for them.'}. Comment naturally - ${wasHit ? 'celebrate that the shape is working, maybe note what dimension made this click.' : 'frame positively: misses teach more than hits, no predictions are 100%, this helps calibrate for everyone with similar shapes. Ask what didn\'t land or what they were hoping for.'}]`

        const newMessages = [...chatMessages, { role: 'user', content: outcomeMessage }]

        try {
          const [shapebaseData, userHistory] = await Promise.all([
            getWeightedPredictions(shape.dimensions, 8.0, 15),
            getUserHistoryForChat(user.id)
          ])

          const res = await fetch('/api/chat', {
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

  // Delete a prediction
  const handleDeletePrediction = async (predictionId: string) => {
    const prediction = activePredictions.find(p => p.id === predictionId)

    // If it's in the database, we could delete it there too
    // For now, just remove from local state
    setActivePredictions(prev => prev.filter(p => p.id !== predictionId))

    // TODO: Add supabase delete if dbId exists
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
      {/* Giant faint shape in background - animates on shape updates */}
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
            <h1 className="text-3xl font-bold">Shape Theory</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Discover your entertainment shape
            </p>
          </div>
        </div>
        {user && (
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Sign out
          </button>
        )}
      </div>
      
      {user && (
        <div className="flex items-center gap-4 mb-8">
          <p className="text-sm text-gray-500">{user.email}</p>
          <button
            onClick={() => setShowAppInfo(true)}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            What is this?
          </button>
          <button
            onClick={() => setShowAbreInfo(true)}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Who is Abre?
          </button>
        </div>
      )}

      {/* App Info Popup */}
      {showAppInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAppInfo(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">What is Shape Theory?</h2>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>
                Shape Theory maps your entertainment preferences across 10 dimensions — not genres, but <em>how</em> you experience content.
              </p>
              <p>
                Things like your tolerance for darkness, need for intellectual engagement, appreciation for craft, and comfort with vulnerability.
              </p>
              <p>
                Your "shape" predicts what you'll enjoy better than genre labels ever could. A folk album and a prestige drama might share more DNA than two comedies.
              </p>
              <p>
                As you rate content and refine your shape, we learn from users with similar shapes to make better predictions — closing the loop between recommendation and outcome.
              </p>
            </div>
            <button
              onClick={() => setShowAppInfo(false)}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
                <strong>Abre</strong> (AH-bray) is your guide through Shape Theory. The name means "opens" in Spanish and Portuguese — and as an imperative, it's a gentle command: <em>open</em>.
              </p>
              <p>
                That's what Abre is here to do: open you to new experiences, open connections between you and people whose shapes resemble yours, and open your understanding of why you connect with what you do.
              </p>
              <p>
                Abre is warm but direct, curious about patterns, and genuinely invested in getting recommendations right for you. She'll ask questions, propose shape adjustments, and always be honest when something's a tricky call.
              </p>
              <p>
                Think of her as a friend who happens to be obsessed with dimensional analysis of entertainment — and wants to help you find your next favorite thing.
              </p>
            </div>
            <button
              onClick={() => setShowAbreInfo(false)}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {!user ? (
        <Auth onAuth={() => {}} />
      ) : !shape ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              List some favorites — movies, shows, music, comedians, anything:
            </label>
            <textarea
              value={favorites}
              onChange={(e) => setFavorites(e.target.value)}
              placeholder="e.g., The Bear, Tyler Childers, Battlestar Galactica, Louis CK, Death Cab for Cutie..."
              className="w-full h-32 p-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
          <button
            onClick={captureShape}
            disabled={shapeLoading || !favorites.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shapeLoading ? 'Analyzing...' : 'Capture My Shape'}
          </button>
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
                      ? 'bg-blue-100 dark:bg-blue-900 ml-8'
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
                placeholder="Ask for recommendations, rate something, explore..."
                className="flex-1 p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
              />
              <button
                onClick={sendMessage}
                disabled={shapeLoading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
                  {historyExpanded ? '▲' : '▼'}
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
                                {pred.outcome === 'hit' ? '✓ Hit' : pred.outcome === 'miss' ? '✗ Miss' : '~ Fence'}
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
                      // Exclude fence from calibration calculation
                      const decisive = completedPredictions.filter(p => p.outcome !== 'fence')
                      const hits = decisive.filter(p => p.outcome === 'hit').length
                      const avgProbability = decisive.length > 0
                        ? Math.round(decisive.reduce((sum, p) => sum + p.hit_probability, 0) / decisive.length)
                        : 0
                      const actualHitRate = decisive.length > 0
                        ? Math.round((hits / decisive.length) * 100)
                        : 0

                      if (decisive.length === 0) {
                        return <span className="text-gray-500">No decisive outcomes yet</span>
                      }

                      return (
                        <div className="space-y-1">
                          <div>
                            <strong>{hits}/{decisive.length}</strong> hits ({actualHitRate}% hit rate)
                          </div>
                          <div className="text-xs text-gray-500">
                            Avg prediction: {avgProbability}% · Actual: {actualHitRate}%
                            {Math.abs(avgProbability - actualHitRate) <= 10
                              ? ' · Well calibrated!'
                              : avgProbability > actualHitRate
                              ? ' · Predictions running hot'
                              : ' · Predictions running cold'}
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
              ? 'bg-green-100 dark:bg-green-900 ring-2 ring-green-500'
              : 'bg-gray-100/80 dark:bg-gray-800/80'
          }`}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Your Shape</h2>
              {shapeUpdated && (
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
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
                      className="h-full bg-blue-600 rounded"
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
