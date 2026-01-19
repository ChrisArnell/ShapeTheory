'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { saveUserShape, loadUserShape, getWeightedPredictions, getUserHistoryForChat, saveUserProfile, savePrediction, recordOutcome, getPendingPredictions, getCompletedPredictions } from '@/lib/db'
import Auth from '@/components/Auth'
import ShapeRadar from '@/components/ShapeRadar'
import ActivePredictions from '@/components/ActivePredictions'

interface LocalPrediction {
  id: string
  title: string
  content_type: string
  predicted_enjoyment: number
  match_percent?: number
  reasoning?: string
  status: 'suggested' | 'locked' | 'completed'
  predicted_at?: string
  dbId?: string  // database ID once locked in
}

interface CompletedPrediction {
  id: string
  title: string
  content_type: string
  predicted_enjoyment: number
  actual_enjoyment: number
  completed_at: string
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

  const loadExistingShape = async () => {
    if (!user) return

    const existingShape = await loadUserShape(user.id)
    if (existingShape && Object.keys(existingShape).length > 0) {
      setShape({ dimensions: existingShape, summary: 'Welcome back!' })
      setChatMessages([{
        role: 'assistant',
        content: "Hey! Abre here. Good to see you again. Looking for something to watch or listen to? Or want to work more on your shape? I can run a quick quiz on any dimension that feels off, or you can tell me more things you love or hate and we'll keep refining."
      }])

      // Load existing pending predictions
      const pending = await getPendingPredictions(user.id)
      if (pending && pending.length > 0) {
        setActivePredictions(pending.map((p: any) => ({
          id: p.id,
          dbId: p.id,
          title: p.content?.title || 'Unknown',
          content_type: p.content?.content_type || 'other',
          predicted_enjoyment: p.predicted_enjoyment,
          status: 'locked' as const,
          predicted_at: p.predicted_at
        })))
      }

      // Load completed predictions for history
      const completed = await getCompletedPredictions(user.id)
      if (completed && completed.length > 0) {
        setCompletedPredictions(completed.map((p: any) => ({
          id: p.id,
          title: p.content?.title || 'Unknown',
          content_type: p.content?.content_type || 'other',
          predicted_enjoyment: p.predicted_enjoyment,
          actual_enjoyment: p.actual_enjoyment,
          completed_at: p.completed_at
        })))
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

      // If Abre updated the shape, save it
      if (data.shapeUpdates && data.shapeUpdates.updates) {
        const newDimensions = { ...shape.dimensions, ...data.shapeUpdates.updates }
        const saved = await saveUserShape(user.id, newDimensions)
        if (saved) {
          setShape({ ...shape, dimensions: newDimensions })
          setShapeUpdated(true)
          setTimeout(() => setShapeUpdated(false), 3000)
        }
      }

      // If Abre saved name or mood, persist it
      if (data.nameUpdate || data.moodUpdate) {
        await saveUserProfile(user.id, {
          ...(data.nameUpdate && { display_name: data.nameUpdate }),
          ...(data.moodUpdate && { current_mood: data.moodUpdate })
        })
      }

      // If Abre created a prediction, add it to suggestions
      if (data.newPrediction) {
        const newPred: LocalPrediction = {
          id: `suggested-${Date.now()}`,
          title: data.newPrediction.title,
          content_type: data.newPrediction.content_type,
          predicted_enjoyment: data.newPrediction.predicted_enjoyment,
          match_percent: data.newPrediction.match_percent,
          reasoning: data.newPrediction.reasoning,
          status: 'suggested'
        }
        setActivePredictions(prev => [...prev, newPred])
      }

      setChatMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      console.error('Error sending message:', err)
    }

    setShapeLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setShape(null)
    setChatMessages([])
    setFavorites('')
    setActivePredictions([])
  }

  // Lock in a suggested prediction - save to database
  const handleLockIn = async (prediction: LocalPrediction) => {
    if (!user || !shape) return

    const dbId = await savePrediction(
      user.id,
      prediction.title,
      prediction.content_type,
      prediction.predicted_enjoyment,
      shape.dimensions,
      undefined // mood_before - could capture this
    )

    if (dbId) {
      setActivePredictions(prev =>
        prev.map(p =>
          p.id === prediction.id
            ? { ...p, status: 'locked' as const, dbId }
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
  const handleRecordOutcome = async (predictionId: string, actual: number) => {
    const prediction = activePredictions.find(p => p.id === predictionId)
    if (!prediction?.dbId) return

    const success = await recordOutcome(prediction.dbId, actual)
    if (success) {
      // Add to completed predictions
      setCompletedPredictions(prev => [{
        id: prediction.dbId!,
        title: prediction.title,
        content_type: prediction.content_type,
        predicted_enjoyment: prediction.predicted_enjoyment,
        actual_enjoyment: actual,
        completed_at: new Date().toISOString()
      }, ...prev])

      // Remove from active
      setActivePredictions(prev => prev.filter(p => p.id !== predictionId))
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
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
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
          {/* Shape Display */}
          <div className={`p-4 rounded-lg transition-colors duration-300 ${
            shapeUpdated
              ? 'bg-green-100 dark:bg-green-900 ring-2 ring-green-500'
              : 'bg-gray-100 dark:bg-gray-800'
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

          {/* Chat Interface */}
          <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="h-64 overflow-y-auto p-4 space-y-3">
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
                className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium">
                  Prediction History ({completedPredictions.length})
                </span>
                <span className="text-gray-500">
                  {historyExpanded ? '▲' : '▼'}
                </span>
              </button>

              {historyExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left">Title</th>
                        <th className="px-4 py-2 text-center">Predicted</th>
                        <th className="px-4 py-2 text-center">Actual</th>
                        <th className="px-4 py-2 text-center">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedPredictions.map((pred) => {
                        const diff = Math.abs(pred.predicted_enjoyment - pred.actual_enjoyment)
                        const isHit = diff <= 1
                        return (
                          <tr key={pred.id} className="border-t dark:border-gray-700">
                            <td className="px-4 py-2">{pred.title}</td>
                            <td className="px-4 py-2 text-center">{pred.predicted_enjoyment}</td>
                            <td className="px-4 py-2 text-center">{pred.actual_enjoyment}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs ${
                                isHit
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                                {isHit ? `+/- ${diff}` : `off by ${diff}`}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Accuracy Summary */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 text-sm">
                    {(() => {
                      const hits = completedPredictions.filter(p =>
                        Math.abs(p.predicted_enjoyment - p.actual_enjoyment) <= 1
                      ).length
                      const accuracy = Math.round((hits / completedPredictions.length) * 100)
                      return (
                        <span>
                          <strong>{accuracy}%</strong> accuracy ({hits}/{completedPredictions.length} within +/- 1 point)
                        </span>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reset Shape */}
          <button
            onClick={() => {
              setShape(null)
              setFavorites('')
              setChatMessages([])
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Recapture my shape
          </button>
        </div>
      )}
    </main>
  )
}
