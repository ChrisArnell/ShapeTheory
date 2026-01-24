import { NextResponse } from 'next/server'

interface Essay {
  title: string
  subtitle: string
  date: string
  slug: string
  content: string
  link: string
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = xml.match(regex)
  return (match?.[1] || match?.[2] || '').trim()
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  try {
    const allEssays: Essay[] = []
    let page = 1
    const maxPages = 5 // Safety limit

    // Substack RSS paginates - keep fetching until no new items
    while (page <= maxPages) {
      const url = page === 1
        ? 'https://shapetheoryesvn.substack.com/feed'
        : `https://shapetheoryesvn.substack.com/feed?page=${page}`

      const res = await fetch(url, {
        next: { revalidate: 3600 } // Cache for 1 hour
      })

      if (!res.ok) break

      const xml = await res.text()
      const items = xml.split('<item>').slice(1)

      if (items.length === 0) break

      const essays: Essay[] = items.map(item => {
        const title = stripHtml(extractTag(item, 'title'))
        const link = extractTag(item, 'link')
        const pubDate = extractTag(item, 'pubDate')
        const description = stripHtml(extractTag(item, 'description'))

        // content:encoded has the full HTML content
        const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
        const content = contentMatch?.[1] || ''

        return {
          title,
          subtitle: description,
          date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : '',
          slug: slugify(title),
          content,
          link
        }
      })

      allEssays.push(...essays)

      // If we got fewer than 20, we've reached the end
      if (items.length < 20) break
      page++
    }

    // Deduplicate by slug in case of overlap
    const seen = new Set<string>()
    const deduped = allEssays.filter(e => {
      if (seen.has(e.slug)) return false
      seen.add(e.slug)
      return true
    })

    return NextResponse.json({ essays: deduped })
  } catch (error: any) {
    console.error('Failed to fetch essays:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch essays' },
      { status: 500 }
    )
  }
}
