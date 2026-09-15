import { Fragment, type ReactNode } from 'react'
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown'

/**
 * Renders a lesson body.
 *
 * Note what is absent: `dangerouslySetInnerHTML`. Every string that came from
 * the database reaches the page as a JSX text child, so React escapes it. The
 * only elements on the page are the ones written literally below, and the only
 * attribute derived from author input is a link's `href`, which
 * lib/markdown.ts has already checked against a scheme allow-list.
 *
 * That is the whole security argument, and it holds even if the parser has
 * bugs: a parser bug produces wrong-looking output, not executable markup.
 */

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.value}</Fragment>
      case 'code':
        return (
          <code
            key={index}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
          >
            {node.value}
          </code>
        )
      case 'strong':
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {renderInline(node.children)}
          </strong>
        )
      case 'em':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'link': {
        // An off-site link opens in a new tab. `rel` is not optional here:
        // without `noopener` the opened page can navigate this one via
        // window.opener, which is the classic reverse-tabnabbing phishing
        // route — and this is a site where people sign in.
        const external = /^https?:\/\//i.test(node.href)
        return (
          <a
            key={index}
            href={node.href}
            className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900"
            {...(external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {renderInline(node.children)}
          </a>
        )
      }
    }
  })
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case 'heading': {
      // The level was decided by the parser, which maps `#` to h2 so the
      // page's own <h1> stays the only one.
      const Heading = `h${block.level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const size =
        block.level === 2
          ? 'text-xl sm:text-2xl'
          : block.level === 3
            ? 'text-lg sm:text-xl'
            : 'text-base sm:text-lg'
      return (
        <Heading
          key={key}
          className={`mt-8 mb-3 font-semibold text-slate-900 first:mt-0 ${size}`}
        >
          {renderInline(block.children)}
        </Heading>
      )
    }

    case 'paragraph':
      return (
        <p key={key} className="my-4 leading-relaxed text-slate-700">
          {renderInline(block.children)}
        </p>
      )

    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List
          key={key}
          className={`my-4 space-y-2 pl-6 text-slate-700 ${
            block.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {block.items.map((item, index) => (
            <li key={index} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </List>
      )
    }

    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-5 border-l-4 border-navy-200 bg-slate-50 py-1 pl-4 text-slate-600 italic"
        >
          {block.children.map((child, index) => renderBlock(child, index))}
        </blockquote>
      )

    case 'code':
      return (
        <pre
          key={key}
          className="my-5 overflow-x-auto rounded-(--radius-card) bg-slate-900 p-4 text-sm text-slate-100"
        >
          <code>{block.value}</code>
        </pre>
      )

    case 'rule':
      return <hr key={key} className="my-8 border-slate-200" />
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        This lesson has no content yet.
      </p>
    )
  }

  return <div>{blocks.map((block, index) => renderBlock(block, index))}</div>
}
