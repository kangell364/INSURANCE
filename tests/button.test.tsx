import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, ButtonLink, type ButtonVariant } from '@/components/ui/Button'

/* ==========================================================================
   Button colour integrity.

   These exist because of a real bug: the hero's "Browse courses" button was
   given `className="bg-transparent text-white"` on top of the `secondary`
   variant's own `bg-white text-navy-800`. Tailwind emits each utility once in
   its own position in the stylesheet, so the winner is decided by CSS order,
   not by the order of the strings — the result was white text on a white
   background, i.e. an invisible button that shipped and passed every test.

   The fix was to add `accent` and `inverse` variants. These tests make sure
   nobody reintroduces the pattern.
   ========================================================================== */

const VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'danger',
  'accent',
  'inverse',
]

/**
 * The utilities that apply in the resting state.
 *
 * State-prefixed utilities (`hover:`, `focus-visible:`, `disabled:`) are
 * excluded: `hover:bg-white/10` is a legitimate hover treatment and must not be
 * confused with a resting `bg-white`.
 */
function restingUtilities(className: string): string[] {
  return className.split(/\s+/).filter((c) => c.length > 0 && !c.includes(':'))
}

/** Resting utilities that set a background. */
function backgroundUtilities(className: string): string[] {
  return restingUtilities(className).filter((c) => /^bg-/.test(c))
}

/** Resting utilities that set a text colour, ignoring sizes like `text-sm`. */
function textColourUtilities(className: string): string[] {
  const SIZES = new Set(['text-xs', 'text-sm', 'text-base', 'text-lg'])
  return restingUtilities(className).filter(
    (c) => /^text-/.test(c) && !SIZES.has(c),
  )
}

/** True when the resting colours would render the label invisible. */
function isInvisible(className: string): boolean {
  const resting = restingUtilities(className)
  return resting.includes('bg-white') && resting.includes('text-white')
}

describe('Button variants', () => {
  it.each(VARIANTS)(
    'variant "%s" declares at most one background and one text colour',
    (variant) => {
      render(<Button variant={variant}>Label</Button>)
      const className = screen.getByRole('button').className

      expect(backgroundUtilities(className).length).toBeLessThanOrEqual(1)
      expect(textColourUtilities(className).length).toBeLessThanOrEqual(1)
    },
  )

  it.each(VARIANTS)('variant "%s" renders its label', (variant) => {
    render(<Button variant={variant}>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('never pairs a white background with white text', () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(<Button variant={variant}>Label</Button>)
      const className = screen.getByRole('button').className

      expect(isInvisible(className), `variant "${variant}" is invisible`).toBe(
        false,
      )
      unmount()
    }
  })

  it('gives the dark-ground variants a light foreground', () => {
    for (const variant of ['accent', 'inverse'] as const) {
      const { unmount } = render(<Button variant={variant}>Label</Button>)
      expect(restingUtilities(screen.getByRole('button').className)).toContain(
        'text-white',
      )
      unmount()
    }
  })
})

describe('ButtonLink', () => {
  it('renders an anchor, not a button', () => {
    render(<ButtonLink href="/courses">Browse courses</ButtonLink>)

    const link = screen.getByRole('link', { name: 'Browse courses' })
    expect(link).toHaveAttribute('href', '/courses')
  })

  it.each(VARIANTS)(
    'variant "%s" keeps its label readable as a link',
    (variant) => {
      render(
        <ButtonLink href="/x" variant={variant}>
          Label
        </ButtonLink>,
      )
      const className = screen.getByRole('link').className

      expect(backgroundUtilities(className).length).toBeLessThanOrEqual(1)
      expect(isInvisible(className)).toBe(false)
    },
  )
})

describe('Button behaviour', () => {
  it('is disabled and marked busy while loading', () => {
    render(<Button loading>Save</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the loading label in place of the children', () => {
    render(
      <Button loading loadingLabel="Saving…">
        Save
      </Button>,
    )

    expect(screen.getByRole('button')).toHaveTextContent('Saving…')
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Label</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
