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
  onRecordOutcome: (predictionId: string, outcome: 'hit' | 'miss' | 'fence', notes?: string) => void
  onDelete: (predictionId: string) => void
}

// Feedback is requested when predictions are surprising:
// - Hit when prediction was < 60% (unexpected success)
// - Miss when prediction was > 40% (unexpected failure)
function shouldRequestFeedback(outcome: 'hit' | 'miss' | 'fence', hitProbability: number): boolean {
  if (outcome === 'fence') return false
  if (outcome === 'hit' && hitProbability < 60) return true
  if (outcome === 'miss' && hitProbability > 40) return true
  return false
}

interface FeedbackState {
  predictionId: string
  outcome: 'hit' | 'miss'
  title: string
  hitProbability: number
}

export default function ActivePredictions({
  predictions,
  onLockIn,
  onDismiss,
  onRecordOutcome,
  onDelete
}: ActivePredictionsProps) {
  const [showOutcomeFor, setShowOutcomeFor] = useState<string | null>(null)
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null)
  const [feedbackText, setFeedbackText] = useState('')

  // Handle outcome selection - either record immediately or show feedback modal
  const handleOutcomeClick = (pred: Prediction, outcome: 'hit' | 'miss' | 'fence') => {
    setShowOutcomeFor(null)

    if (shouldRequestFeedback(outcome, pred.hit_probability)) {
      // Show feedback modal for surprising outcomes
      setFeedbackState({
        predictionId: pred.id,
        outcome: outcome as 'hit' | 'miss',
        title: pred.title,
        hitProbability: pred.hit_probability
      })
      setFeedbackText('')
    } else {
      // Record immediately for expected outcomes
      onRecordOutcome(pred.id, outcome)
    }
  }

  // Submit feedback and record outcome
  const handleFeedbackSubmit = (skip: boolean = false) => {
    if (!feedbackState) return

    const notes = skip ? undefined : feedbackText.trim() || undefined
    onRecordOutcome(feedbackState.predictionId, feedbackState.outcome, notes)
    setFeedbackState(null)
    setFeedbackText('')
  }

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
                      onClick={() => handleOutcomeClick(pred, 'hit')}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Hit
                    </button>
                    <button
                      onClick={() => handleOutcomeClick(pred, 'fence')}
                      className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                      title="Use sparingly - for genuine ambiguity"
                    >
                      Fence
                    </button>
                    <button
                      onClick={() => handleOutcomeClick(pred, 'miss')}
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

      {/* Feedback Modal for surprising outcomes */}
      {feedbackState && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => handleFeedbackSubmit(true)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">
              {feedbackState.outcome === 'hit' ? 'Unexpected hit!' : 'Unexpected miss!'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              <strong>{feedbackState.title}</strong> was predicted at {feedbackState.hitProbability}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {feedbackState.outcome === 'hit'
                ? "What did you like about this that we might not be capturing?"
                : "What didn't you like that we might not be capturing?"}
            </p>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="What stood out that we might be missing?"
              className="w-full p-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleFeedbackSubmit(false)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Submit
              </button>
              <button
                onClick={() => handleFeedbackSubmit(true)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
