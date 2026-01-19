'use client'

import { useState, useEffect } from 'react'
import { savePrediction, getPendingPredictions, getCompletedPredictions, recordOutcome, getPredictionStats } from '@/lib/db'
import ContentPicker from './ContentPicker'

interface PredictionsProps {
  userId: string
  userShape: Record<string, number>
}

export default function Predictions({ userId, userShape }: PredictionsProps) {
  const [pending, setPending] = useState<any[]>([])
  const [completed, setCompleted] = useState<any[]>([])
  const [stats, setStats] = useState<{ total: number; hits: number; accuracy: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  // Commit form state
  const [showCommitForm, setShowCommitForm] = useState(false)
  const [selectedContent, setSelectedContent] = useState<{ id: string | null; title: string; content_type: string } | null>(null)
  const [predictedEnjoyment, setPredictedEnjoyment] = useState(7)
  const [moodBefore, setMoodBefore] = useState('')
  const [committing, setCommitting] = useState(false)

  // Outcome form state
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [actualEnjoyment, setActualEnjoyment] = useState(7)
  const [moodAfter, setMoodAfter] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)
    const [pendingData, completedData, statsData] = await Promise.all([
      getPendingPredictions(userId),
      getCompletedPredictions(userId),
      getPredictionStats(userId)
    ])
    setPending(pendingData)
    setCompleted(completedData)
    setStats(statsData)
    setLoading(false)
  }

  const handleCommit = async () => {
    if (!selectedContent) return
    setCommitting(true)

    const predictionId = await savePrediction(
      userId,
      selectedContent.title,
      selectedContent.content_type,
      predictedEnjoyment,
      userShape,
      moodBefore || undefined
    )

    if (predictionId) {
      setSelectedContent(null)
      setPredictedEnjoyment(7)
      setMoodBefore('')
      setShowCommitForm(false)
      await loadData()
    }

    setCommitting(false)
  }

  const handleRecordOutcome = async (predictionId: string) => {
    const success = await recordOutcome(
      predictionId,
      actualEnjoyment,
      moodAfter || undefined,
      notes || undefined
    )
    
    if (success) {
      setRecordingId(null)
      setActualEnjoyment(7)
      setMoodAfter('')
      setNotes('')
      await loadData()
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <div className="text-gray-500">Loading predictions...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Prediction Accuracy:</strong> {stats.hits}/{stats.total} hits 
            ({Math.round((stats.accuracy || 0) * 100)}%)
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
            A "hit" is when predicted enjoyment is within 2 points of actual.
          </div>
        </div>
      )}

      {/* Commit Section */}
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Lock In a Prediction</h3>
          {!showCommitForm && (
            <button
              onClick={() => setShowCommitForm(true)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              + Commit
            </button>
          )}
        </div>
        
        {showCommitForm && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">What are you going to watch/listen to?</label>
              <ContentPicker
                onSelect={setSelectedContent}
                userShape={userShape}
                placeholder="Search or type content name..."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Predicted enjoyment: <strong>{predictedEnjoyment}</strong>/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={predictedEnjoyment}
                onChange={(e) => setPredictedEnjoyment(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Current mood (optional)</label>
              <input
                type="text"
                value={moodBefore}
                onChange={(e) => setMoodBefore(e.target.value)}
                placeholder="e.g., tired, anxious, bored, curious..."
                className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCommit}
                disabled={committing || !selectedContent}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {committing ? 'Saving...' : 'Lock It In'}
              </button>
              <button
                onClick={() => {
                  setShowCommitForm(false)
                  setSelectedContent(null)
                }}
                className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Predictions */}
      {pending.length > 0 && (
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Pending ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map((p: any) => (
              <div key={p.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                {recordingId === p.id ? (
                  // Outcome recording form
                  <div className="space-y-3">
                    <div className="font-medium">{p.content?.title || 'Unknown'}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      You predicted: {p.predicted_enjoyment}/10
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">
                        Actual enjoyment: <strong>{actualEnjoyment}</strong>/10
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={actualEnjoyment}
                        onChange={(e) => setActualEnjoyment(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Mood after (optional)</label>
                      <input
                        type="text"
                        value={moodAfter}
                        onChange={(e) => setMoodAfter(e.target.value)}
                        placeholder="e.g., satisfied, surprised, disappointed..."
                        className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Notes (optional)</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="What worked? What didn't? Why was your prediction off?"
                        className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700 h-20"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRecordOutcome(p.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Record Outcome
                      </button>
                      <button
                        onClick={() => setRecordingId(null)}
                        className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Pending prediction display
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{p.content?.title || 'Unknown'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Predicted: {p.predicted_enjoyment}/10 • {formatDate(p.predicted_at)}
                        {p.mood_before && ` • Mood: ${p.mood_before}`}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRecordingId(p.id)
                        setActualEnjoyment(p.predicted_enjoyment)
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Report Outcome
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Predictions */}
      {completed.length > 0 && (
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">History</h3>
          <div className="space-y-2">
            {completed.slice(0, 5).map((p: any) => {
              const diff = p.actual_enjoyment - p.predicted_enjoyment
              const hit = Math.abs(diff) <= 2
              return (
                <div key={p.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{p.content?.title || 'Unknown'}</span>
                    <span className={hit ? 'text-green-600' : 'text-red-600'}>
                      {hit ? '✓ Hit' : '✗ Miss'}
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Predicted: {p.predicted_enjoyment} → Actual: {p.actual_enjoyment}
                    {diff !== 0 && ` (${diff > 0 ? '+' : ''}${diff})`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pending.length === 0 && completed.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          No predictions yet. Commit to watching something and report back!
        </div>
      )}
    </div>
  )
}
