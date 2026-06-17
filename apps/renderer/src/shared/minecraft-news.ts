const NEWS_HUB_URL = 'https://www.minecraft.net/en-us/article'
const NEWS_BASE_URL = 'https://www.minecraft.net'

export interface MinecraftNewsItem {
  title: string
  summary: string
  imageUrl: string | null
  url: string
  publishedAt?: string | null
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function absolutizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return new URL(url, NEWS_BASE_URL).toString()
}

function firstMatch(value: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(value)
    if (match?.[1]) return match[1]
  }
  return null
}

export function parseMinecraftNewsHtml(html: string): MinecraftNewsItem[] {
  const items: MinecraftNewsItem[] = []
  const seen = new Set<string>()
  const cardRe = /<a\b[^>]*href="(?<href>(?:https?:\/\/(?:www\.)?minecraft\.net)?\/en-us\/article\/[^"]+)"[^>]*>(?<body>[\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(cardRe)) {
    const href = match.groups?.href
    const body = match.groups?.body ?? ''
    if (!href || seen.has(href)) continue

    const title = firstMatch(body, [
      /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
      /<h2\b[^>]*>([\s\S]*?)<\/h2>/i,
      /<h3\b[^>]*>([\s\S]*?)<\/h3>/i,
    ])
    const summary = firstMatch(body, [
      /<p\b[^>]*>([\s\S]*?)<\/p>/i,
      /<div\b[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ])
    if (!title || !summary) continue

    const image = firstMatch(body, [
      /<img\b[^>]*src="([^"]+)"/i,
      /<img\b[^>]*data-src="([^"]+)"/i,
      /<source\b[^>]*srcset="([^"]+)"/i,
    ])
    let imageUrl: string | null = null
    if (image) {
      const candidate = image.split(',')[0]?.trim().split(/\s+/)[0]
      if (candidate) imageUrl = absolutizeUrl(candidate)
    }

    const publishedAt = firstMatch(body, [
      /<time\b[^>]*datetime="([^"]+)"/i,
      /<time\b[^>]*>([\s\S]*?)<\/time>/i,
    ])

    seen.add(href)
    items.push({
      title: stripTags(title),
      summary: stripTags(summary),
      imageUrl,
      url: absolutizeUrl(href),
      publishedAt: publishedAt ? stripTags(publishedAt) : null,
    })
  }

  return items
}

export async function fetchMinecraftNews(): Promise<MinecraftNewsItem[]> {
  try {
    const response = await fetch(NEWS_HUB_URL, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
    if (!response.ok) return []
    const html = await response.text()
    return parseMinecraftNewsHtml(html)
  } catch {
    return []
  }
}
