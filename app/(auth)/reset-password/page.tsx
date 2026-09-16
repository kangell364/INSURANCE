import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Choose a new password',
  // A recovery token arrives in this URL. Keeping the page out of indexes is
  // cheap insurance against a link ending up somewhere it can be crawled.
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardBody className="py-8">
        <h1 className="text-xl">Choose a new password</h1>
        <p className="mt-1.5 mb-6 text-sm text-slate-600">
          Pick something you have not used elsewhere.
        </p>

        {isSupabaseConfigured() ? (
          <ResetPasswordForm />
        ) : (
          <Alert variant="warning" title="Authentication is not configured">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}
