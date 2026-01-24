import { NextResponse } from 'next/server'

interface Essay {
  title: string
  subtitle: string
  date: string
  slug: string
  content: string
  link: string
}

// Master list of all essay URLs (add new ones here when you publish)
const ALL_ESSAY_URLS = [
  'https://shapetheoryesvn.substack.com/p/why-most-fields-dont-learn',
  'https://shapetheoryesvn.substack.com/p/do-your-own-research',
  'https://shapetheoryesvn.substack.com/p/shape-theory-summary',
  'https://shapetheoryesvn.substack.com/p/the-cure-is-a-verb',
  'https://shapetheoryesvn.substack.com/p/the-rosetta-stone-for-behavioral',
  'https://shapetheoryesvn.substack.com/p/i-wish-i-was-crazy-but-unfortunately',
  'https://shapetheoryesvn.substack.com/p/there-are-no-bad-decisions',
  'https://shapetheoryesvn.substack.com/p/the-cost-of-shapefit',
  'https://shapetheoryesvn.substack.com/p/first-do-harm',
  'https://shapetheoryesvn.substack.com/p/the-balance',
  'https://shapetheoryesvn.substack.com/p/the-universal-balance-initiative',
  'https://shapetheoryesvn.substack.com/p/the-engine-has-a-name',
  'https://shapetheoryesvn.substack.com/p/the-religion-of-the-balance',
  'https://shapetheoryesvn.substack.com/p/the-shape-of-entertainment',
  'https://shapetheoryesvn.substack.com/p/the-human-in-the-loop-singularity',
  'https://shapetheoryesvn.substack.com/p/trust-me-bro',
  'https://shapetheoryesvn.substack.com/p/the-empty-chair',
]

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

    // Extract title from meta
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/) ||
                        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
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

    // Extract content - try multiple patterns for Substack's HTML
    const bodyMatch = html.match(/<div class="body markup"[^>]*>([\s\S]*?)<\/div>\s*(<div class="footer"|<div class="post-footer"|<\/article>|<div class="subscribe)/)
    const altMatch = html.match(/<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)
    const content = bodyMatch?.[1] || altMatch?.[1] || ''

    if (!title) return null

    const urlSlug = url.split('/p/')[1]?.replace(/\/+$/, '') || ''

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
    // Step 1: Fetch RSS feed (gives us latest 20 with full content, cached 1hr)
    const rssRes = await fetch('https://shapetheoryesvn.substack.com/feed', {
      next: { revalidate: 3600 }
    })

    const rssEssaysByLink = new Map<string, Essay>()

    if (rssRes.ok) {
      const xml = await rssRes.text()
      const items = xml.split('<item>').slice(1)

      for (const item of items) {
        const title = stripHtml(extractTag(item, 'title'))
        const link = extractTag(item, 'link').replace(/\/+$/, '')
        const pubDate = extractTag(item, 'pubDate')
        const description = stripHtml(extractTag(item, 'description'))
        const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
        const content = contentMatch?.[1] || ''

        const essay: Essay = {
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
        rssEssaysByLink.set(link, essay)
      }
    }

    // Step 2: For each URL in our master list, use RSS data if available,
    // otherwise fetch the post individually (cached 24hr)
    const missingUrls = ALL_ESSAY_URLS.filter(url => !rssEssaysByLink.has(url.replace(/\/+$/, '')))

    const fetchedEssays = await Promise.all(
      missingUrls.map(url => fetchPostData(url))
    )

    // Step 3: Build final list - RSS essays + individually fetched ones
    // Also include any RSS essays not in our hardcoded list (new posts)
    const allEssays: Essay[] = []
    const usedLinks = new Set<string>()

    // First add all from RSS (these have the best content)
    for (const essay of rssEssaysByLink.values()) {
      allEssays.push(essay)
      usedLinks.add(essay.link)
    }

    // Then add individually fetched ones
    for (const essay of fetchedEssays) {
      if (essay && !usedLinks.has(essay.link)) {
        allEssays.push(essay)
        usedLinks.add(essay.link)
      }
    }

    // Sort by date (newest first)
    allEssays.sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return NextResponse.json({ essays: allEssays })
  } catch (error: any) {
    console.error('Failed to fetch essays:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch essays' },
      { status: 500 }
    )
  }
}
