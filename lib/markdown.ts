/**
 * A deliberately small Markdown parser for lesson bodies.
 *
 * WHY NOT A LIBRARY
 *
 * The obvious choice is `marked` (or similar) plus a sanitiser. That pairing
 * works, but it is a DENY-list: the parser happily emits whatever HTML the
 * source contains, and a second package is configured to strip the dangerous
 * parts afterwards. The safety of the result depends on that configuration
 * being right, and on it staying right across upgrades of both packages.
 *
 * This parser is an ALLOW-list instead. It never produces HTML at all. It
 * produces a small typed tree of nodes that this module defines, and
 * components/Markdown.tsx renders that tree as React elements — which means
 * every piece of author text reaches the page as a JSX text child, and React
 * escapes it. There is no `dangerouslySetInnerHTML` in the render path, so
 * even a bug in this file cannot inject markup: the worst it can do is render
 * something ugly.
 *
 * The cost is coverage. This understands a subset of Markdown:
 *
 *   # .. ######    headings        (mapped DOWN one level; see below)
 *   paragraphs
 *   - * +          unordered lists
 *   1.             ordered lists
 *   >              blockquotes (nestable)
 *   ```            fenced code blocks
 *   ---            thematic breaks
 *   `code`  **bold**  *italic*  [text](href)
 *
 * Not supported, deliberately: raw HTML (treated as literal text), tables,
 * images, footnotes, reference links, nested lists. Tables and images are the
 * two most likely to be wanted for insurance content — coverage comparisons
 * and form diagrams — and both should be added as explicit node types here
 * rather than by swapping in a general-purpose parser.
 */

// --- Node types -------------------------------------------------------------

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Block[] }
  | { type: 'code'; language: string | null; value: string }
  | { type: 'rule' }

/**
 * How deep a blockquote may nest before the parser stops recursing and treats
 * the remainder as plain paragraphs.
 *
 * A bound is necessary, not decorative: `parseBlocks` recurses for each level
 * of `>`, and a body consisting of ten thousand `>` characters would otherwise
 * be a stack overflow — i.e. a way for anyone who can write a lesson body to
 * crash the server rendering it.
 */
const MAX_QUOTE_DEPTH = 6

// --- Inline parsing ---------------------------------------------------------

/**
 * URL schemes a link may use.
 *
 * An allow-list, so `javascript:`, `data:` and `vbscript:` are excluded by
 * default rather than by enumeration. A link whose href is rejected is not
 * dropped — it renders as its own label text, so the reader still sees the
 * words the author wrote and an editor can spot what went wrong.
 */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (href.length === 0 || href.length > 2048) return null

  // Same-site paths and in-page anchors.
  if (href.startsWith('/') || href.startsWith('#')) {
    // `//evil.example` is protocol-relative, i.e. off-site, despite starting
    // with a slash.
    return href.startsWith('//') ? null : href
  }

  if (/^https?:\/\/[^\s]+$/i.test(href)) return href
  if (/^mailto:[^\s]+$/i.test(href)) return href

  return null
}

const CODE_SPAN = /`([^`\n]+)`/
// The href alternation allows ONE level of balanced parentheses. A naive
// `[^)\s]+` stops at the first `)`, which mangles two very different inputs
// in the same way: a legitimate URL such as
// `https://en.wikipedia.org/wiki/Insurance_(disambiguation)`, and a hostile
// one such as `javascript:alert(1)` — the latter was left half-matched, so the
// link was correctly refused but a stray `)` was rendered after the label.
const LINK = /\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/
const STRONG = /\*\*([^*\n]+)\*\*/
const EM = /(?<!\*)\*([^*\n]+)\*(?!\*)/

/**
 * Parses inline markup.
 *
 * The order is load-bearing. Code spans are taken first and their contents are
 * never re-parsed, so `` `**not bold**` `` renders as literal asterisks —
 * which is what an author documenting Markdown syntax expects. Links come
 * before emphasis so that a link label may contain bold text. `**` is matched
 * before `*` so that bold is not read as two empty italics.
 */
export function parseInline(source: string): Inline[] {
  if (source.length === 0) return []

  const code = CODE_SPAN.exec(source)
  if (code) {
    return [
      ...parseInline(source.slice(0, code.index)),
      { type: 'code', value: code[1] },
      ...parseInline(source.slice(code.index + code[0].length)),
    ]
  }

  const link = LINK.exec(source)
  if (link) {
    const href = safeHref(link[2])
    const label = link[1].length > 0 ? link[1] : link[2]
    return [
      ...parseInline(source.slice(0, link.index)),
      href
        ? { type: 'link', href, children: parseInline(label) }
        : // Rejected scheme: keep the author's words, drop the link.
          { type: 'text', value: label },
      ...parseInline(source.slice(link.index + link[0].length)),
    ]
  }

  const strong = STRONG.exec(source)
  if (strong) {
    return [
      ...parseInline(source.slice(0, strong.index)),
      { type: 'strong', children: parseInline(strong[1]) },
      ...parseInline(source.slice(strong.index + strong[0].length)),
    ]
  }

  const em = EM.exec(source)
  if (em) {
    return [
      ...parseInline(source.slice(0, em.index)),
      { type: 'em', children: parseInline(em[1]) },
      ...parseInline(source.slice(em.index + em[0].length)),
    ]
  }

  return [{ type: 'text', value: source }]
}

// --- Block parsing ----------------------------------------------------------

const HEADING = /^(#{1,6})\s+(.*)$/
const UNORDERED = /^[-*+]\s+(.*)$/
const ORDERED = /^\d{1,9}[.)]\s+(.*)$/
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/
const FENCE = /^```\s*([A-Za-z0-9+#-]{0,20})\s*$/
const QUOTE = /^>\s?(.*)$/

function parseBlocks(lines: string[], depth: number): Block[] {
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().length === 0) {
      i += 1
      continue
    }

    // Fenced code. Everything up to the closing fence is taken verbatim — no
    // inline parsing, no trimming of leading whitespace.
    const fence = FENCE.exec(line)
    if (fence) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      // An unterminated fence runs to the end of the document rather than
      // being rejected: half-written content should still render.
      i += 1
      blocks.push({
        type: 'code',
        language: fence[1].length > 0 ? fence[1] : null,
        value: body.join('\n'),
      })
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      i += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      // Mapped down one level on purpose. The page already renders the lesson
      // title as its <h1>; a body that emitted a second <h1> would give the
      // page two document titles, which screen readers announce as two
      // separate documents. `#` therefore becomes <h2>.
      const level = Math.min(6, heading[1].length + 1) as 2 | 3 | 4 | 5 | 6
      blocks.push({
        type: 'heading',
        level,
        children: parseInline(heading[2].trim()),
      })
      i += 1
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote) {
      const body: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(QUOTE.exec(lines[i])![1])
        i += 1
      }
      if (depth >= MAX_QUOTE_DEPTH) {
        // Too deep to recurse safely: render the remaining markers literally.
        blocks.push({ type: 'paragraph', children: parseInline(body.join(' ')) })
      } else {
        blocks.push({ type: 'quote', children: parseBlocks(body, depth + 1) })
      }
      continue
    }

    // Lists. RULE is tested above, so `* * *` is a thematic break rather
    // than a one-item list, which is the conventional reading.
    //
    // A run ends when a line stops matching the SAME marker kind, so an
    // unordered list immediately followed by an ordered one produces two
    // blocks rather than one mixed list.
    const listPattern = ORDERED.test(line)
      ? ORDERED
      : UNORDERED.test(line)
        ? UNORDERED
        : null

    if (listPattern) {
      const items: Inline[][] = []
      while (i < lines.length) {
        const item = listPattern.exec(lines[i])
        if (!item) break
        items.push(parseInline(item[1].trim()))
        i += 1
      }
      blocks.push({ type: 'list', ordered: listPattern === ORDERED, items })
      continue
    }

    // Paragraph: consecutive non-blank lines that start no other block.
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim().length > 0 &&
      !HEADING.test(lines[i]) &&
      !RULE.test(lines[i]) &&
      !FENCE.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !UNORDERED.test(lines[i]) &&
      !ORDERED.test(lines[i])
    ) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    if (paragraph.length > 0) {
      // A newline inside a paragraph is a space, as in Markdown proper.
      blocks.push({
        type: 'paragraph',
        children: parseInline(paragraph.join(' ')),
      })
    }
  }

  return blocks
}

/** Parses a lesson body into a renderable tree. */
export function parseMarkdown(source: string): Block[] {
  if (typeof source !== 'string' || source.length === 0) return []
  // Normalise line endings so a body authored on Windows parses identically.
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'), 0)
}

/**
 * Plain text with all markup removed.
 *
 * Used for meta descriptions and search snippets, where emitting markup would
 * be wrong and emitting the raw source would be ugly.
 */
export function markdownToPlainText(source: string): string {
  const fromInline = (nodes: Inline[]): string =>
    nodes
      .map((node) => {
        switch (node.type) {
          case 'text':
          case 'code':
            return node.value
          default:
            return fromInline(node.children)
        }
      })
      .join('')

  const fromBlocks = (blocks: Block[]): string =>
    blocks
      .map((block) => {
        switch (block.type) {
          case 'heading':
          case 'paragraph':
            return fromInline(block.children)
          case 'list':
            return block.items.map(fromInline).join(' ')
          case 'quote':
            return fromBlocks(block.children)
          case 'code':
            return block.value
          case 'rule':
            return ''
        }
      })
      .filter((part) => part.length > 0)
      .join(' ')

  return fromBlocks(parseMarkdown(source)).replace(/\s+/g, ' ').trim()
}
