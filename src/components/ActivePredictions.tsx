'use client'

import { useState } from 'react'

interface Prediction {
  id: string
  title: string
  content_type: string
  hit_probability: number
  status: 'suggested' | 'locked' | 'completed'
  predicted_at?: string
}

interface ActivePredictionsProps {
  predictions: Prediction[]
  onLockIn: (prediction: Prediction) => void
  onDismiss: (predictionId: string) => void
  onRecordOutcome: (predictionId: string, outcome: 'hit' | 'miss' | 'fence') => void
  onDelete: (predictionId: string) => void
}

export default function ActivePredictions({
  predictions,
  onLockIn,
  onDismiss,
  onRecordOutcome,
  onDelete
}: ActivePredictionsProps) {
  const [showOutcomeFor, setShowOutcomeFor] = useState<string | null>(null)

  const suggested = predictions.filter(p => p.status === 'suggested')
  const locked = predictions.filter(p => p.status === 'locked')

  if (predictions.length === 0) {
    return null
  }

  const contentTypeIcon = (type: string) => {
    switch (type) {
      case 'movie': return '🎬'
      case 'show': return '📺'
      case 'album': return '💿'
      case 'song': return '🎵'
      case 'podcast': return '🎙️'
      case 'comedy_special': return '🎤'
      default: return '📝'
    }
  }

  return (
    <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
      {/* Suggested by Abre - needs lock-in */}
      {suggested.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-2">Abre suggested:</div>
          <div className="flex flex-wrap gap-2">
            {suggested.map(pred => (
              <div
                key={pred.id}
                className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2"
              >
                <span>{contentTypeIcon(pred.content_type)}</span>
                <span className="font-medium text-sm">{pred.title}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {pred.hit_probability}%
                </span>
                <button
                  onClick={() => onLockIn(pred)}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Lock in
                </button>
                <button
                  onClick={() => onDismiss(pred.id)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked in - user's to-do list */}
      {locked.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Your queue ({locked.length}):</div>
          <div className="flex flex-wrap gap-2">
            {locked.map(pred => (
              <div
                key={pred.id}
                className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2"
              >
                <span>{contentTypeIcon(pred.content_type)}</span>
                <span className="font-medium text-sm">{pred.title}</span>
                <span className="text-xs text-green-600 dark:text-green-400">
                  {pred.hit_probability}%
                </span>

                {showOutcomeFor === pred.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onRecordOutcome(pred.id, 'hit')
                        setShowOutcomeFor(null)
                      }}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Hit
                    </button>
                    <button
                      onClick={() => {
                        onRecordOutcome(pred.id, 'fence')
                        setShowOutcomeFor(null)
                      }}
                      className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                      title="Use sparingly - for genuine ambiguity"
                    >
                      Fence
                    </button>
                    <button
                      onClick={() => {
                        onRecordOutcome(pred.id, 'miss')
                        setShowOutcomeFor(null)
                      }}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    >
                      Miss
                    </button>
                    <button
                      onClick={() => setShowOutcomeFor(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowOutcomeFor(pred.id)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Done?
                    </button>
                    <button
                      onClick={() => onDelete(pred.id)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                      title="Remove from queue"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
