/**
 * HTML to Markdown conversion utility
 * Provides a reusable function for converting HTML content to Markdown
 */

/**
 * Convert HTML to clean text suitable for display
 * This strips Markdown formatting for UI display purposes
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''

  let text = html

  // Remove style and script tags with content
  text = text.replace(/<style[^>]*>.*?<\/style>/gis, '')
  text = text.replace(/<script[^>]*>.*?<\/script>/gis, '')

  // Convert bold tags (but don't add markdown)
  text = text.replace(/<b>(.*?)<\/b>/gi, '$1')
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '$1')

  // Convert italic tags (but don't add markdown)
  text = text.replace(/<i>(.*?)<\/i>/gi, '$1')
  text = text.replace(/<em>(.*?)<\/em>/gi, '$1')

  // Convert paragraphs to spaces
  text = text.replace(/<p[^>]*>/gi, ' ')
  text = text.replace(/<\/p>/gi, ' ')

  // Convert divs to spaces
  text = text.replace(/<div[^>]*>/gi, ' ')
  text = text.replace(/<\/div>/gi, ' ')

  // Convert list items to spaces (no numbers or bullets for plain text)
  text = text.replace(/<li[^>]*>/gi, ' ')
  text = text.replace(/<\/li>/gi, ' ')
  text = text.replace(/<\/?ol[^>]*>/gi, ' ')
  text = text.replace(/<\/?ul[^>]*>/gi, ' ')

  // Convert headers to plain text
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1 ')

  // Convert links to just the text
  text = text.replace(/<a[^>]+href="[^"]+"[^>]*>(.*?)<\/a>/gi, '$1')

  // Remove code tags
  text = text.replace(/<code>(.*?)<\/code>/gi, '$1')

  // Remove blockquotes
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '$1')

  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')

  // Clean up excessive whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Convert HTML to Markdown for content generation
 * This preserves formatting as Markdown syntax
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''

  let text = html

  // Remove style and script tags with content
  text = text.replace(/<style[^>]*>.*?<\/style>/gis, '')
  text = text.replace(/<script[^>]*>.*?<\/script>/gis, '')

  // Convert bold tags
  text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**')
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**')

  // Convert italic tags
  text = text.replace(/<i>(.*?)<\/i>/gi, '_$1_')
  text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_')

  // Convert headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')

  // Convert paragraphs
  text = text.replace(/<p[^>]*>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')

  // Convert divs
  text = text.replace(/<div[^>]*>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')

  // Convert ordered lists
  const olRegex = /<ol[^>]*>(.*?)<\/ol>/gis
  text = text.replace(olRegex, (match, content) => {
    let counter = 0
    const items = content.replace(/<li[^>]*>(.*?)<\/li>/gis, (m: string, item: string) => {
      counter++
      return `\n${counter}. ${item.trim()}`
    })
    return '\n' + items + '\n'
  })

  // Convert unordered lists
  const ulRegex = /<ul[^>]*>(.*?)<\/ul>/gis
  text = text.replace(ulRegex, (match, content) => {
    const items = content.replace(/<li[^>]*>(.*?)<\/li>/gis, (m: string, item: string) => {
      return `\n- ${item.trim()}`
    })
    return '\n' + items + '\n'
  })

  // Remove list tags that might remain
  text = text.replace(/<\/?ol[^>]*>/gi, '\n')
  text = text.replace(/<\/?ul[^>]*>/gi, '\n')
  text = text.replace(/<\/?li[^>]*>/gi, '')

  // Convert links
  text = text.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

  // Convert code tags to backticks
  text = text.replace(/<code>(.*?)<\/code>/gi, '`$1`')

  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')

  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim()

  return text
}