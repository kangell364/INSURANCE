import { describe, expect, it } from 'vitest'
import {
  markdownToPlainText,
  parseInline,
  parseMarkdown,
  type Block,
  type Inline,
} from '@/lib/markdown'

/** Flattens a tree back to its visible text, for concise assertions. */
function text(nodes: Inline[]): string {
  return nodes
    .map((n) =>
      n.type === 'text' || n.type === 'code' ? n.value : text(n.children),
    )
    .join('')
}

function firstOfType<T extends Block['type']>(
  blocks: Block[],
  type: T,
): Extract<Block, { type: T }> {
  const found = blocks.find((b) => b.type === type)
  if (!found) throw new Error(`no ${type} block in ${JSON.stringify(blocks)}`)
  return found as Extract<Block, { type: T }>
}

describe('block parsing', () => {
  it('maps # down to h2 so the body cannot emit a second page title', () => {
    const blocks = parseMarkdown('# Coverage basics')
    expect(firstOfType(blocks, 'heading').level).toBe(2)
  })

  it('maps deeper headings consistently and clamps at h6', () => {
    expect(firstOfType(parseMarkdown('## Two'), 'heading').level).toBe(3)
    expect(firstOfType(parseMarkdown('##### Five'), 'heading').level).toBe(6)
    expect(firstOfType(parseMarkdown('###### Six'), 'heading').level).toBe(6)
  })

  it('joins consecutive lines into one paragraph', () => {
    const blocks = parseMarkdown('A named peril\npolicy covers only\n\nNext.')
    expect(blocks).toHaveLength(2)
    expect(text(firstOfType(blocks, 'paragraph').children)).toBe(
      'A named peril policy covers only',
    )
  })

  it('parses unordered lists', () => {
    const list = firstOfType(parseMarkdown('- Fire\n- Theft\n- Hail'), 'list')
    expect(list.ordered).toBe(false)
    expect(list.items.map(text)).toEqual(['Fire', 'Theft', 'Hail'])
  })

  it('parses ordered lists', () => {
    const list = firstOfType(parseMarkdown('1. First\n2. Second'), 'list')
    expect(list.ordered).toBe(true)
    expect(list.items.map(text)).toEqual(['First', 'Second'])
  })

  it('does not merge an unordered list into an ordered one', () => {
    const blocks = parseMarkdown('- A\n- B\n1. C')
    expect(blocks.filter((b) => b.type === 'list')).toHaveLength(2)
  })

  it('reads *** as a thematic break, not a one-item list', () => {
    expect(parseMarkdown('***')).toEqual([{ type: 'rule' }])
    expect(parseMarkdown('---')).toEqual([{ type: 'rule' }])
  })

  it('keeps fenced code verbatim and records its language', () => {
    const block = firstOfType(
      parseMarkdown('```sql\nselect  *\n  from policies;\n```'),
      'code',
    )
    expect(block.language).toBe('sql')
    expect(block.value).toBe('select  *\n  from policies;')
  })

  it('does not parse markup inside a fenced block', () => {
    const block = firstOfType(parseMarkdown('```\n**not bold**\n```'), 'code')
    expect(block.value).toBe('**not bold**')
  })

  it('runs an unterminated fence to the end rather than failing', () => {
    const block = firstOfType(parseMarkdown('```\nhalf written'), 'code')
    expect(block.value).toBe('half written')
  })

  it('parses blockquotes as nested blocks', () => {
    const quote = firstOfType(parseMarkdown('> Tex. Ins. Code 4051'), 'quote')
    expect(text(firstOfType(quote.children, 'paragraph').children)).toBe(
      'Tex. Ins. Code 4051',
    )
  })

  it('survives pathologically nested blockquotes without overflowing', () => {
    // A body anyone with authoring access could write. Before the depth cap
    // this recursed once per marker.
    const evil = '>'.repeat(50_000) + ' boom'
    expect(() => parseMarkdown(evil)).not.toThrow()
  })

  it('treats an empty or non-string body as no content', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown(undefined as unknown as string)).toEqual([])
  })

  it('normalises Windows line endings', () => {
    expect(parseMarkdown('- A\r\n- B')).toEqual(parseMarkdown('- A\n- B'))
  })
})

describe('inline parsing', () => {
  it('parses bold, italic and code', () => {
    expect(parseInline('**b**')).toEqual([
      { type: 'strong', children: [{ type: 'text', value: 'b' }] },
    ])
    expect(parseInline('*i*')).toEqual([
      { type: 'em', children: [{ type: 'text', value: 'i' }] },
    ])
    expect(parseInline('`c`')).toEqual([{ type: 'code', value: 'c' }])
  })

  it('reads ** as bold rather than two empty italics', () => {
    const nodes = parseInline('**deductible**')
    expect(nodes[0].type).toBe('strong')
  })

  it('does not parse markup inside a code span', () => {
    expect(parseInline('`**literal**`')).toEqual([
      { type: 'code', value: '**literal**' },
    ])
  })

  it('allows bold inside a link label', () => {
    const nodes = parseInline('[**TDI**](https://www.tdi.texas.gov)')
    expect(nodes[0]).toMatchObject({
      type: 'link',
      href: 'https://www.tdi.texas.gov',
    })
    expect(text(nodes)).toBe('TDI')
  })

  it('keeps surrounding text around inline markup', () => {
    expect(text(parseInline('a **b** c'))).toBe('a b c')
  })
})

/* ==========================================================================
   The security tests.

   This parser exists so that a lesson body can never put markup on the page.
   It emits a typed tree and nothing else — components/Markdown.tsx renders it
   as JSX text children, which React escapes — so the assertion in each case is
   that hostile input survives as inert TEXT.
   ========================================================================== */
describe('untrusted body content', () => {
  it('treats a script tag as literal text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>')
    const paragraph = firstOfType(blocks, 'paragraph')
    expect(paragraph.children).toEqual([
      { type: 'text', value: '<script>alert(1)</script>' },
    ])
  })

  it('treats an event-handler attribute as literal text', () => {
    const blocks = parseMarkdown('<img src=x onerror="alert(1)">')
    expect(firstOfType(blocks, 'paragraph').children[0].type).toBe('text')
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example/phish',
  ])('refuses the href %s and keeps the label as text', (href) => {
    const nodes = parseInline(`[Click here](${href})`)
    expect(nodes.every((n) => n.type !== 'link')).toBe(true)
    expect(text(nodes)).toBe('Click here')
  })

  it.each([
    'https://www.tdi.texas.gov/',
    'http://example.com/a?b=c',
    'mailto:help@example.com',
    '/courses/texas-general-lines',
    '#exam-blueprint',
    // Regression: a naive href pattern stopped at the first ')' and broke
    // this, and left a stray ')' behind when it rejected 'javascript:alert(1)'.
    'https://en.wikipedia.org/wiki/Insurance_(disambiguation)',
  ])('allows the href %s', (href) => {
    const nodes = parseInline(`[Link](${href})`)
    expect(nodes[0]).toMatchObject({ type: 'link', href })
  })

  it('never produces a node type outside the known set', () => {
    const known = new Set([
      'heading',
      'paragraph',
      'list',
      'quote',
      'code',
      'rule',
    ])
    const hostile = [
      '<iframe src="https://evil.example"></iframe>',
      '<!-- comment -->',
      '<style>body{display:none}</style>',
      '![img](javascript:alert(1))',
      '<a href="javascript:alert(1)">x</a>',
    ].join('\n\n')

    for (const block of parseMarkdown(hostile)) {
      expect(known.has(block.type)).toBe(true)
    }
  })
})

describe('markdownToPlainText', () => {
  it('strips markup for use in meta descriptions', () => {
    expect(
      markdownToPlainText('# Title\n\nA **bold** claim about `coverage`.'),
    ).toBe('Title A bold claim about coverage.')
  })

  it('collapses whitespace', () => {
    expect(markdownToPlainText('A\n\n\nB')).toBe('A B')
  })

  it('returns an empty string for an empty body', () => {
    expect(markdownToPlainText('')).toBe('')
  })
})
