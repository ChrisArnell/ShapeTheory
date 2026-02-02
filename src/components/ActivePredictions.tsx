'use client'

import { useState } from 'react'

interface Prediction {
  id: string
  title: string
  artist?: string
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
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null)
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

  // Check if content type is playable on Spotify
  const isSpotifyContent = (type: string) => {
    return ['album', 'song', 'ep', 'single', 'live_album', 'compilation', 'podcast'].includes(type)
  }

  // Open in Spotify using search URL - reuses the same browser tab
  const openInSpotify = (title: string, artist?: string) => {
    const query = artist ? `${title} ${artist}` : title
    const url = `https://open.spotify.com/search/${encodeURIComponent(query)}`
    window.open(url, 'spotify')
  }

  // Display title with artist if artist is provided and not already in title
  const displayTitle = (pred: Prediction) => {
    if (pred.artist && !pred.title.toLowerCase().includes(pred.artist.toLowerCase())) {
      return `${pred.title} - ${pred.artist}`
    }
    return pred.title
  }

  return (
    <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
      {/* Suggestion Box - prominent display for Abre's suggestions */}
      {suggested.length > 0 && (
        <div className="mb-3 space-y-2">
          {suggested.map(pred => (
            <div
              key={pred.id}
              className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/40 dark:to-purple-900/40 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{contentTypeIcon(pred.content_type)}</span>
                  <div>
                    <div className="font-semibold text-base">{displayTitle(pred)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Abre thinks <span className="font-medium text-blue-600 dark:text-blue-400">{pred.hit_probability}%</span> chance you'll like this
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSpotifyContent(pred.content_type) && (
                    <button
                      onClick={() => openInSpotify(pred.title, pred.artist)}
                      className="px-3 py-2 bg-[#1DB954] text-white rounded-lg hover:bg-[#1ed760] text-sm transition-colors flex items-center gap-1"
                      title="Play in Spotify"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      <span>Play</span>
                    </button>
                  )}
                  <button
                    onClick={() => onLockIn(pred)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                  >
                    Lock it in
                  </button>
                  <button
                    onClick={() => onDismiss(pred.id)}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
                    title="Dismiss suggestion"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          ))}
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
                <span className="font-medium text-sm">{displayTitle(pred)}</span>
                <span className="text-xs text-green-600 dark:text-green-400">
                  {pred.hit_probability}%
                </span>

                {isSpotifyContent(pred.content_type) && (
                  <button
                    onClick={() => openInSpotify(pred.title, pred.artist)}
                    className="text-[#1DB954] hover:text-[#1ed760] transition-colors"
                    title="Play in Spotify"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </button>
                )}

                {deleteConfirmFor === pred.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                    <button
                      onClick={() => {
                        onDelete(pred.id)
                        setDeleteConfirmFor(null)
                      }}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirmFor(null)}
                      className="text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                    >
                      No
                    </button>
                  </div>
                ) : showOutcomeFor === pred.id ? (
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
                      onClick={() => setDeleteConfirmFor(pred.id)}
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
