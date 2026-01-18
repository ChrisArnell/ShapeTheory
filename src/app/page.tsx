'use client'

import { useState } from 'react'

export default function Home() {
  const [favorites, setFavorites] = useState('')
  const [shape, setShape] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')

  const captureShape = async () => {
    if (!favorites.trim()) return
    setLoading(true)
    
    try {
      const res = await fetch('/api/shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites })
      })
      const data = await res.json()
      setShape(data)
      setChatMessages([{ role: 'assistant', content: data.summary }])
    } catch (err) {
      console.error('Error capturing shape:', err)
    }
    
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || !shape) return
    
    const newMessages = [...chatMessages, { role: 'user', content: input }]
    setChatMessages(newMessages)
    setInput('')
    setLoading(true)

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
      setChatMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      console.error('Error sending message:', err)
    }
    
    setLoading(false)
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Shape Theory</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Discover your entertainment shape
      </p>

      {!shape ? (
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
            disabled={loading || !favorites.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Capture My Shape'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Shape Display */}
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="font-semibold mb-3">Your Shape</h2>
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
              {loading && (
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
                disabled={loading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              setShape(null)
              setFavorites('')
              setChatMessages([])
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Start over
          </button>
        </div>
      )}
    </main>
  )
}
