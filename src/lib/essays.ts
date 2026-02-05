export interface Essay {
  title: string
  subtitle: string
  date: string
  sortDate: string
  slug: string
  content: string
  link: string
}

// Master list of all essay URLs (add new ones here when you publish)
export const ALL_ESSAY_URLS = [
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
  'https://shapetheoryesvn.substack.com/p/the-hidden-question-behind-every',
  'https://shapetheoryesvn.substack.com/p/definitional-capture-summary',
  'https://shapetheoryesvn.substack.com/p/the-shape-that-isnt-one',
  'https://shapetheoryesvn.substack.com/p/the-law-of-adaptive-system-progress',
  'https://shapetheoryesvn.substack.com/p/cookies-for-things-that-matter',
  'https://shapetheoryesvn.substack.com/p/cookies-for-cancer',
  'https://shapetheoryesvn.substack.com/p/the-three-hidden-disagreements',
  'https://shapetheoryesvn.substack.com/p/closing-the-loop-for-everything',
  'https://shapetheoryesvn.substack.com/p/accumulated-wisdom',
  'https://shapetheoryesvn.substack.com/p/what-ai-is-and-isnt',
]

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = xml.match(regex)
  return (match?.[1] || match?.[2] || '').trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '').trim())
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function fetchPostData(url: string): Promise<Essay | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const html = await res.text()

    let title = ''
    let subtitle = ''
    let sortDate = ''

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1])
        title = decodeEntities(jsonLd.headline || '')
        subtitle = decodeEntities(jsonLd.description || '')
        if (jsonLd.datePublished) {
          sortDate = new Date(jsonLd.datePublished).toISOString()
        }
      } catch { /* JSON parse failed, fall through */ }
    }

    if (!title) {
      const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/) ||
                          html.match(/<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)
      title = titleMatch ? stripHtml(titleMatch[1] || titleMatch[2] || '') : ''
    }

    if (!subtitle) {
      const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/) ||
                        html.match(/<meta name="description" content="([^"]*)"/)
      subtitle = descMatch ? decodeEntities(descMatch[1]) : ''
    }

    if (!sortDate) {
      const dateMatch = html.match(/<time[^>]*datetime="([^"]*)"/) ||
                        html.match(/<meta property="article:published_time" content="([^"]*)"/)
      if (dateMatch) {
        sortDate = new Date(dateMatch[1]).toISOString()
      }
    }

    const bodyMatch = html.match(/<div[^>]*class="[^"]*body markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(<div class="footer"|<div class="post-footer"|<\/article>|<div class="subscribe)/)
    const altMatch = html.match(/<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)
    const content = bodyMatch?.[1] || altMatch?.[1] || ''

    if (!title) return null

    const urlSlug = url.split('/p/')[1]?.replace(/\/+$/, '') || ''

    return {
      title,
      subtitle,
      date: sortDate ? new Date(sortDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : '',
      sortDate,
      slug: urlSlug || slugify(title),
      content,
      link: url
    }
  } catch {
    return null
  }
}

export async function getEssays(): Promise<Essay[]> {
  let rssRes: Response | null = null
  try {
    rssRes = await fetch('https://shapetheoryesvn.substack.com/feed', {
      next: { revalidate: 3600 }
    })
  } catch {
    // Network error (e.g. during build with no internet)
  }

  const rssEssaysByLink = new Map<string, Essay>()

  if (rssRes?.ok) {
    const xml = await rssRes.text()
    const items = xml.split('<item>').slice(1)

    for (const item of items) {
      const title = stripHtml(extractTag(item, 'title'))
      const link = extractTag(item, 'link').replace(/\/+$/, '')
      const pubDate = extractTag(item, 'pubDate')
      const description = stripHtml(extractTag(item, 'description'))
      const contentMatch = item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
      const content = contentMatch?.[1] || ''

      const sortDate = pubDate ? new Date(pubDate).toISOString() : ''
      const essay: Essay = {
        title,
        subtitle: description,
        date: sortDate ? new Date(sortDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : '',
        sortDate,
        slug: slugify(title),
        content,
        link
      }
      rssEssaysByLink.set(link, essay)
    }
  }

  const missingUrls = ALL_ESSAY_URLS.filter(url => !rssEssaysByLink.has(url.replace(/\/+$/, '')))

  const fetchedEssays = await Promise.all(
    missingUrls.map(url => fetchPostData(url))
  )

  const allEssays: Essay[] = []
  const usedLinks = new Set<string>()

  Array.from(rssEssaysByLink.values()).forEach(essay => {
    allEssays.push(essay)
    usedLinks.add(essay.link)
  })

  for (const essay of fetchedEssays) {
    if (essay && !usedLinks.has(essay.link)) {
      allEssays.push(essay)
      usedLinks.add(essay.link)
    }
  }

  allEssays.sort((a, b) => {
    if (!a.sortDate && !b.sortDate) return 0
    if (!a.sortDate) return 1
    if (!b.sortDate) return -1
    return a.sortDate.localeCompare(b.sortDate)
  })

  return allEssays
}
