'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { saveUserShape, loadUserShape } from '@/lib/db'
import Auth from '@/components/Auth'
import Predictions from '@/components/Predictions'
import ShapeRadar from '@/components/ShapeRadar'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState('')
  const [shape, setShape] = useState<any>(null)
  const [shapeLoading, setShapeLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'predictions'>('chat')
  const [shapeUpdated, setShapeUpdated] = useState(false)

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
      setShape({ dimensions: existingShape, summary: 'Welcome back. Your shape is loaded.' })
      setChatMessages([{ 
        role: 'assistant', 
        content: "Welcome back. I remember your shape. What are you in the mood for?" 
      }])
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          shape: shape.dimensions
        })
      })
      const data = await res.json()

      // If Claude updated the shape, save it
      if (data.shapeUpdates && data.shapeUpdates.updates) {
        const newDimensions = { ...shape.dimensions, ...data.shapeUpdates.updates }
        const saved = await saveUserShape(user.id, newDimensions)
        if (saved) {
          setShape({ ...shape, dimensions: newDimensions })
          setShapeUpdated(true)
          // Clear the indicator after 3 seconds
          setTimeout(() => setShapeUpdated(false), 3000)
        }
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
              <ShapeRadar dimensions={shape.dimensions} size={120} />
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
        <p className="text-sm text-gray-500 mb-8">{user.email}</p>
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

          {/* Tab Navigation */}
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 border-b-2 ${
                activeTab === 'chat' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('predictions')}
              className={`px-4 py-2 border-b-2 ${
                activeTab === 'predictions' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Predictions
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'chat' ? (
            <>
              {/* Chat Interface */}
              <div className="border dark:border-gray-700 rounded-lg">
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
              </div>
            </>
          ) : (
            <Predictions userId={user.id} userShape={shape.dimensions} />
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
