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

// Fetch full content from individual post page
async function fetchPostContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }) // Cache 24h for individual posts
    if (!res.ok) return ''
    const html = await res.text()

    // Substack puts post content in a div with class "body markup"
    const bodyMatch = html.match(/<div class="body markup"[^>]*>([\s\S]*?)<\/div>\s*(<div class="footer"|<div class="post-footer"|<\/article>|<div class="subscribe)/)
    if (bodyMatch) return bodyMatch[1]

    // Fallback: look for the post-content area
    const altMatch = html.match(/<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)
    if (altMatch) return altMatch[1]

    return ''
  } catch {
    return ''
  }
}

export async function GET() {
  try {
    // Step 1: Fetch RSS feed (gives us latest 20 with full content)
    const rssRes = await fetch('https://shapetheoryesvn.substack.com/feed', {
      next: { revalidate: 3600 }
    })

    const rssEssays: Essay[] = []

    if (rssRes.ok) {
      const xml = await rssRes.text()
      const items = xml.split('<item>').slice(1)

      for (const item of items) {
        const title = stripHtml(extractTag(item, 'title'))
        const link = extractTag(item, 'link')
        const pubDate = extractTag(item, 'pubDate')
        const description = stripHtml(extractTag(item, 'description'))
        const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
        const content = contentMatch?.[1] || ''

        rssEssays.push({
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
        })
      }
    }

    // Step 2: Fetch archive page to discover ALL post URLs
    const archiveRes = await fetch('https://shapetheoryesvn.substack.com/archive?sort=new', {
      next: { revalidate: 3600 }
    })

    const additionalEssays: Essay[] = []
    const rssLinks = new Set(rssEssays.map(e => e.link))

    if (archiveRes.ok) {
      const archiveHtml = await archiveRes.text()

      // Find all post links in the archive
      const postLinkRegex = /href="(https:\/\/shapetheoryesvn\.substack\.com\/p\/[^"?]+)"/g
      const foundUrls = new Set<string>()
      let match
      while ((match = postLinkRegex.exec(archiveHtml)) !== null) {
        foundUrls.add(match[1])
      }

      // For posts not in RSS, fetch individually (in parallel)
      const missingUrls = Array.from(foundUrls).filter(url => !rssLinks.has(url))
      const fetched = await Promise.all(
        missingUrls.map(async (postUrl) => {
          const content = await fetchPostContent(postUrl)
          const urlSlug = postUrl.split('/p/')[1] || ''
          const titleFromSlug = urlSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

          return {
            title: titleFromSlug,
            subtitle: '',
            date: '',
            slug: urlSlug,
            content,
            link: postUrl
          }
        })
      )
      additionalEssays.push(...fetched)
    }

    // Combine: RSS essays (newest first) + additional older essays
    const allEssays = [...rssEssays, ...additionalEssays]

    // Deduplicate by slug
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
