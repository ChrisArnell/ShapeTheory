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

// Fetch full post data from individual post page
async function fetchPostData(url: string): Promise<Essay | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }) // Cache 24h
    if (!res.ok) return null
    const html = await res.text()

    // Extract title from meta or h1
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/) ||
                        html.match(/<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
    const title = titleMatch ? stripHtml(titleMatch[1] || titleMatch[2] || '') : ''

    // Extract subtitle/description
    const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/) ||
                      html.match(/<meta name="description" content="([^"]*)"/)
    const subtitle = descMatch ? descMatch[1] : ''

    // Extract publish date
    const dateMatch = html.match(/<time[^>]*datetime="([^"]*)"/) ||
                      html.match(/<meta property="article:published_time" content="([^"]*)"/)
    const date = dateMatch ? new Date(dateMatch[1]).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : ''

    // Extract content
    const bodyMatch = html.match(/<div class="body markup"[^>]*>([\s\S]*?)<\/div>\s*(<div class="footer"|<div class="post-footer"|<\/article>|<div class="subscribe)/)
    const altMatch = html.match(/<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)
    const content = bodyMatch?.[1] || altMatch?.[1] || ''

    if (!title) return null

    const urlSlug = url.split('/p/')[1] || ''

    return {
      title,
      subtitle,
      date,
      slug: urlSlug || slugify(title),
      content,
      link: url
    }
  } catch {
    return null
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
    // Normalize URLs for comparison (strip trailing slashes, query params)
    const normalizeUrl = (url: string) => url.replace(/\/+$/, '').split('?')[0].split('#')[0]
    const rssLinks = new Set(rssEssays.map(e => normalizeUrl(e.link)))
    const rssSlugs = new Set(rssEssays.map(e => e.slug))

    if (archiveRes.ok) {
      const archiveHtml = await archiveRes.text()

      // Find all post links in the archive (exclude /comments URLs)
      const postLinkRegex = /href="(https:\/\/shapetheoryesvn\.substack\.com\/p\/[^"?#]+)"/g
      const foundUrls = new Set<string>()
      let match
      while ((match = postLinkRegex.exec(archiveHtml)) !== null) {
        const url = match[1]
        // Skip comment pages and other non-post URLs
        if (url.includes('/comments') || url.endsWith('/comments')) continue
        foundUrls.add(url)
      }

      // For posts not in RSS, fetch individually (in parallel)
      const missingUrls = Array.from(foundUrls).filter(url => {
        const normalized = normalizeUrl(url)
        const slug = url.split('/p/')[1]?.replace(/\/+$/, '') || ''
        return !rssLinks.has(normalized) && !rssSlugs.has(slug)
      })
      const fetched = await Promise.all(
        missingUrls.map(postUrl => fetchPostData(postUrl))
      )
      additionalEssays.push(...fetched.filter((e): e is Essay => e !== null))
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
