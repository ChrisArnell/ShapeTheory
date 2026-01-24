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
    const res = await fetch('https://shapetheoryesvn.substack.com/feed', {
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!res.ok) {
      throw new Error(`Substack feed returned ${res.status}`)
    }

    const xml = await res.text()

    // Parse RSS items
    const items = xml.split('<item>').slice(1) // Skip everything before first item
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

    // Sort by date (newest first for index, but we'll reverse for reading order)
    return NextResponse.json({ essays })
  } catch (error: any) {
    console.error('Failed to fetch essays:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch essays' },
      { status: 500 }
    )
  }
}
