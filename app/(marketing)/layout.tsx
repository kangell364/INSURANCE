import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'

/**
 * Every page in this group renders SiteHeader, which resolves the signed-in
 * state from the session cookie. Prerendering them would bake one visitor's
 * header (and, worse, the build machine's view of whether Supabase is
 * configured) into static HTML served to everyone. Rendering per request is
 * the correct trade here; the pages themselves do at most one indexed query.
 */
export const dynamic = 'force-dynamic'

/** Shell for the public marketing pages: /, /courses, /about, /contact. */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
