'use client'

import { useState, useEffect } from 'react'
import { getTasteBuds, getBudBio, saveBudBio, AppType } from '@/lib/db'

interface TasteBud {
  user_id_hash: string
  match_percent: number
  bud_bio: string | null
  actual_user_id: string
  isDemo?: boolean
}

// Demo taste buds to show when no real users exist yet
const DEMO_TASTE_BUDS: TasteBud[] = [
  {
    user_id_hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    match_percent: 87.3,
    bud_bio: 'Music enthusiast who loves discovering hidden gems. Into everything from ambient electronica to post-punk revival.',
    actual_user_id: 'demo-1',
    isDemo: true
  },
  {
    user_id_hash: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7',
    match_percent: 74.5,
    bud_bio: 'Vinyl collector, concert junkie. My shape says "chill" but my playlists say "chaos".',
    actual_user_id: 'demo-2',
    isDemo: true
  },
  {
    user_id_hash: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
    match_percent: 68.9,
    bud_bio: null,
    actual_user_id: 'demo-3',
    isDemo: true
  },
  {
    user_id_hash: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9',
    match_percent: 52.1,
    bud_bio: 'Genre-agnostic listener. If it moves me, I\'m in.',
    actual_user_id: 'demo-4',
    isDemo: true
  },
]

interface TasteBudsTableProps {
  userId: string
  userShape: Record<string, number>
  appType?: AppType
}

export default function TasteBudsTable({ userId, userShape, appType = 'music' }: TasteBudsTableProps) {
  const [tasteBuds, setTasteBuds] = useState<TasteBud[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [viewingBio, setViewingBio] = useState<TasteBud | null>(null)
  const [showBioEditor, setShowBioEditor] = useState(false)
  const [myBio, setMyBio] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (userId && userShape && Object.keys(userShape).length > 0) {
      loadTasteBuds()
      loadMyBio()
    }
  }, [userId, userShape])

  const loadTasteBuds = async () => {
    setLoading(true)
    try {
      const buds = await getTasteBuds(userId, userShape, appType)
      // If no real users, show demo data
      if (buds.length === 0) {
        setTasteBuds(DEMO_TASTE_BUDS)
      } else {
        setTasteBuds(buds)
      }
    } catch (err) {
      console.error('Error loading taste buds:', err)
      // Show demo data on error as well
      setTasteBuds(DEMO_TASTE_BUDS)
    }
    setLoading(false)
  }

  const loadMyBio = async () => {
    const bio = await getBudBio(userId, appType)
    setMyBio(bio || '')
    setBioInput(bio || '')
  }

  const handleSaveBio = async () => {
    setSaving(true)
    const success = await saveBudBio(userId, bioInput, appType)
    if (success) {
      setMyBio(bioInput)
      setShowBioEditor(false)
    }
    setSaving(false)
  }

  const shortenHash = (hash: string) => {
    return hash.substring(0, 8) + '...'
  }

  const getMatchColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 dark:text-green-400'
    if (percent >= 60) return 'text-blue-600 dark:text-blue-400'
    if (percent >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  const isShowingDemo = tasteBuds.length > 0 && tasteBuds[0]?.isDemo === true

  if (loading) {
    return (
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <p className="text-gray-500">Loading Taste Buds...</p>
      </div>
    )
  }

  return (
    <>
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex justify-between items-center bg-gray-50/90 dark:bg-gray-800/90 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <span className="font-medium">
            Taste Buds ({tasteBuds.length})
            {isShowingDemo && (
              <span className="ml-2 text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded">
                Preview
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowBioEditor(true)
              }}
              className="text-xs px-2 py-1 border border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30"
            >
              Enter your Bud Bio
            </button>
            <span className="text-gray-500">
              {expanded ? '\u25B2' : '\u25BC'}
            </span>
          </div>
        </button>

        {expanded && (
          <div className="bg-white/90 dark:bg-gray-900/90">
            <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">User ID</th>
                      <th className="px-4 py-2 text-center">% Match</th>
                      <th className="px-4 py-2 text-right">Bio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasteBuds.map((bud) => (
                      <tr key={bud.user_id_hash} className="border-t dark:border-gray-700">
                        <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {shortenHash(bud.user_id_hash)}
                        </td>
                        <td className={`px-4 py-2 text-center font-semibold ${getMatchColor(bud.match_percent)}`}>
                          {bud.match_percent}%
                        </td>
                        <td className="px-4 py-2 text-right">
                          {bud.bud_bio ? (
                            <button
                              onClick={() => setViewingBio(bud)}
                              className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800"
                            >
                              View Bio
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">No bio</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 text-xs text-gray-500">
              {isShowingDemo ? (
                <span>These are example Taste Buds. Real users will appear as more people join!</span>
              ) : (
                <span>Match % calculated using shape similarity across all dimensions</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* View Bio Modal */}
      {viewingBio && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setViewingBio(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Taste Bud Bio</h2>
                <p className="text-sm text-gray-500">
                  {shortenHash(viewingBio.user_id_hash)} - {viewingBio.match_percent}% match
                </p>
              </div>
              <span className={`text-lg font-bold ${getMatchColor(viewingBio.match_percent)}`}>
                {viewingBio.match_percent}%
              </span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-sm">
              {viewingBio.bud_bio}
            </div>
            <button
              onClick={() => setViewingBio(null)}
              className="mt-4 w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit My Bio Modal */}
      {showBioEditor && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowBioEditor(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">Enter your Bud Bio</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Tell your Taste Buds about yourself. What kind of music fan are you? What are you looking for?
            </p>
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              placeholder="e.g., 30s music nerd into everything from shoegaze to hip-hop. Always hunting for that perfect album to get lost in..."
              className="w-full h-32 p-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700 text-sm"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {bioInput.length}/500
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowBioEditor(false)}
                className="flex-1 py-2 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBio}
                disabled={saving}
                className="flex-1 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Bio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
