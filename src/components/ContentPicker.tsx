'use client'

import { useState, useEffect, useRef } from 'react'
import { searchContent, addContent, getWeightedPredictionForContent } from '@/lib/db'

interface ContentPickerProps {
  onSelect: (content: { id: string; title: string; content_type: string; isNew?: boolean }) => void
  userShape?: Record<string, number>
  placeholder?: string
  contentType?: string
}

interface ContentResult {
  id: string
  title: string
  subtitle?: string
  content_type: string
  year?: number
  rating_count?: number
}

export default function ContentPicker({
  onSelect,
  userShape,
  placeholder = "Search or type content name...",
  contentType
}: ContentPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [shapebasePreview, setShapebasePreview] = useState<{ rating: number; count: number } | null>(null)
  const [selectedContent, setSelectedContent] = useState<ContentResult | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newContentType, setNewContentType] = useState(contentType || 'show')

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const data = await searchContent(query, contentType, 8)
      setResults(data)
      setShowDropdown(true)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, contentType])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch shapebase preview when content is selected
  useEffect(() => {
    if (selectedContent && userShape) {
      getWeightedPredictionForContent(userShape, selectedContent.id).then((data: any) => {
        if (data && data.weighted_avg_enjoyment !== undefined) {
          setShapebasePreview({
            rating: data.weighted_avg_enjoyment,
            count: data.rating_count
          })
        } else {
          setShapebasePreview(null)
        }
      })
    } else {
      setShapebasePreview(null)
    }
  }, [selectedContent, userShape])

  const handleSelect = (content: ContentResult) => {
    setSelectedContent(content)
    setQuery(content.title + (content.subtitle ? ` ${content.subtitle}` : ''))
    setShowDropdown(false)
    onSelect({
      id: content.id,
      title: content.title,
      content_type: content.content_type
    })
  }

  const handleAddNew = async () => {
    if (!query.trim()) return
    setAddingNew(true)

    const newId = await addContent(query.trim(), newContentType)

    if (newId) {
      onSelect({
        id: newId,
        title: query.trim(),
        content_type: newContentType,
        isNew: true
      })
      setSelectedContent({
        id: newId,
        title: query.trim(),
        content_type: newContentType
      })
      setShowDropdown(false)
    }

    setAddingNew(false)
  }

  const clearSelection = () => {
    setSelectedContent(null)
    setQuery('')
    setShapebasePreview(null)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedContent(null)
            }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            className="w-full p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
          />
          {loading && (
            <div className="absolute right-3 top-2.5 text-gray-400 text-sm">...</div>
          )}
        </div>
        {selectedContent && (
          <button
            onClick={clearSelection}
            className="px-2 text-gray-400 hover:text-gray-600"
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {results.length > 0 ? (
            <>
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between items-center"
                >
                  <div>
                    <span className="font-medium">{item.title}</span>
                    {item.subtitle && (
                      <span className="text-gray-500 ml-1">{item.subtitle}</span>
                    )}
                    {item.year && (
                      <span className="text-gray-400 ml-1">({item.year})</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.content_type}
                    {item.rating_count && item.rating_count > 0 && (
                      <span className="ml-1">• {item.rating_count} ratings</span>
                    )}
                  </div>
                </button>
              ))}
              <div className="border-t dark:border-gray-700" />
            </>
          ) : query.length >= 2 && !loading ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              No matches found
            </div>
          ) : null}

          {/* Add new option */}
          {query.length >= 2 && (
            <div className="px-3 py-2 border-t dark:border-gray-700">
              <div className="flex items-center gap-2">
                <select
                  value={newContentType}
                  onChange={(e) => setNewContentType(e.target.value)}
                  className="p-1 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
                >
                  <option value="show">TV Show</option>
                  <option value="movie">Movie</option>
                  <option value="album">Album</option>
                  <option value="song">Song</option>
                  <option value="artist">Artist</option>
                  <option value="comedy">Comedy Special</option>
                  <option value="podcast">Podcast</option>
                  <option value="episode">Episode</option>
                </select>
                <button
                  onClick={handleAddNew}
                  disabled={addingNew}
                  className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addingNew ? 'Adding...' : `Add "${query}" as new`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shapebase preview */}
      {selectedContent && shapebasePreview && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
          <span className="text-blue-800 dark:text-blue-200">
            Similar users rated this: <strong>{shapebasePreview.rating.toFixed(1)}/10</strong>
          </span>
          <span className="text-blue-600 dark:text-blue-300 ml-1">
            ({shapebasePreview.count} ratings)
          </span>
        </div>
      )}

      {selectedContent && !shapebasePreview && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-500">
          No ratings from similar users yet. You'll be the first!
        </div>
      )}
    </div>
  )
}
