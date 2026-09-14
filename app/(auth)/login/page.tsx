import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { LoadingPage } from '@/components/ui/States'
import { LoginForm } from '@/components/auth/LoginForm'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <Card>
      <CardBody className="py-8">
        <h1 className="text-xl">Sign in</h1>
        <p className="mt-1.5 mb-6 text-sm text-slate-600">
          Continue your exam preparation.
        </p>

        {isSupabaseConfigured() ? (
          // useSearchParams() requires a Suspense boundary so the rest of the
          // page can still be prerendered.
          <Suspense fallback={<LoadingPage label="Loading sign in…" />}>
            <LoginForm />
          </Suspense>
        ) : (
          <Alert variant="warning" title="Authentication is not configured">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env.local</code>, then restart the development server.
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}
