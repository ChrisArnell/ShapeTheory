import { NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'

interface ContentResult {
  title: string
  content_type: string
  year?: number
  external_id: string
  external_source: string
  metadata?: Record<string, any>
}

// Search TMDB for movies and TV shows
async function searchTMDB(query: string, type?: string): Promise<ContentResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB_API_KEY not set')
    return []
  }

  const results: ContentResult[] = []

  try {
    // Search movies if no type specified or type is movie
    if (!type || type === 'movie') {
      const movieRes = await fetch(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      )
      if (movieRes.ok) {
        const movieData = await movieRes.json()
        for (const movie of movieData.results?.slice(0, 3) || []) {
          results.push({
            title: movie.title,
            content_type: 'movie',
            year: movie.release_date ? parseInt(movie.release_date.slice(0, 4)) : undefined,
            external_id: String(movie.id),
            external_source: 'tmdb',
            metadata: {
              overview: movie.overview,
              poster_path: movie.poster_path,
              vote_average: movie.vote_average
            }
          })
        }
      }
    }

    // Search TV shows if no type specified or type is show
    if (!type || type === 'show') {
      const tvRes = await fetch(
        `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      )
      if (tvRes.ok) {
        const tvData = await tvRes.json()
        for (const show of tvData.results?.slice(0, 3) || []) {
          results.push({
            title: show.name,
            content_type: 'show',
            year: show.first_air_date ? parseInt(show.first_air_date.slice(0, 4)) : undefined,
            external_id: String(show.id),
            external_source: 'tmdb',
            metadata: {
              overview: show.overview,
              poster_path: show.poster_path,
              vote_average: show.vote_average
            }
          })
        }
      }
    }
  } catch (err) {
    console.error('TMDB search error:', err)
  }

  return results
}

// Search MusicBrainz for music (free, no API key needed)
async function searchMusicBrainz(query: string, type?: string): Promise<ContentResult[]> {
  const results: ContentResult[] = []

  try {
    // Search for artists
    if (!type || type === 'artist') {
      const artistRes = await fetch(
        `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
        { headers: { 'User-Agent': 'ShapeTheory/1.0 (contact@example.com)' } }
      )
      if (artistRes.ok) {
        const artistData = await artistRes.json()
        for (const artist of artistData.artists?.slice(0, 3) || []) {
          results.push({
            title: artist.name,
            content_type: 'artist',
            external_id: artist.id,
            external_source: 'musicbrainz',
            metadata: {
              disambiguation: artist.disambiguation,
              type: artist.type,
              country: artist.country
            }
          })
        }
      }
    }

    // Search for albums (release groups)
    if (!type || type === 'album') {
      const albumRes = await fetch(
        `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
        { headers: { 'User-Agent': 'ShapeTheory/1.0 (contact@example.com)' } }
      )
      if (albumRes.ok) {
        const albumData = await albumRes.json()
        for (const album of albumData['release-groups']?.slice(0, 3) || []) {
          const artistName = album['artist-credit']?.[0]?.name || 'Unknown Artist'
          results.push({
            title: `${album.title} - ${artistName}`,
            content_type: 'album',
            year: album['first-release-date'] ? parseInt(album['first-release-date'].slice(0, 4)) : undefined,
            external_id: album.id,
            external_source: 'musicbrainz',
            metadata: {
              artist: artistName,
              type: album['primary-type']
            }
          })
        }
      }
    }

    // Search for songs (recordings)
    if (!type || type === 'song') {
      const songRes = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
        { headers: { 'User-Agent': 'ShapeTheory/1.0 (contact@example.com)' } }
      )
      if (songRes.ok) {
        const songData = await songRes.json()
        for (const song of songData.recordings?.slice(0, 3) || []) {
          const artistName = song['artist-credit']?.[0]?.name || 'Unknown Artist'
          results.push({
            title: `${song.title} - ${artistName}`,
            content_type: 'song',
            external_id: song.id,
            external_source: 'musicbrainz',
            metadata: {
              artist: artistName,
              length: song.length
            }
          })
        }
      }
    }
  } catch (err) {
    console.error('MusicBrainz search error:', err)
  }

  return results
}

export async function POST(req: Request) {
  try {
    const { query, content_type } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    const results: ContentResult[] = []

    // Determine which APIs to search based on content_type
    const isVisual = !content_type || ['movie', 'show', 'comedy_special'].includes(content_type)
    const isMusic = !content_type || ['album', 'song', 'artist', 'podcast'].includes(content_type)

    if (isVisual) {
      const tmdbResults = await searchTMDB(query, content_type)
      results.push(...tmdbResults)
    }

    if (isMusic) {
      const mbResults = await searchMusicBrainz(query, content_type)
      results.push(...mbResults)
    }

    // Sort by relevance (exact title match first)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === query.toLowerCase() ? 0 : 1
      const bExact = b.title.toLowerCase() === query.toLowerCase() ? 0 : 1
      return aExact - bExact
    })

    return NextResponse.json({ results: results.slice(0, 5) })
  } catch (err) {
    console.error('Lookup error:', err)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
