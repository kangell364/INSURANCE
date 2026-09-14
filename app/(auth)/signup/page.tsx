import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { SignupForm } from '@/components/auth/SignupForm'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Create your account' }

export default function SignupPage() {
  return (
    <Card>
      <CardBody className="py-8">
        <h1 className="text-xl">Create your account</h1>
        <p className="mt-1.5 mb-6 text-sm text-slate-600">
          Free to create. Start with the course catalogue.
        </p>

        {isSupabaseConfigured() ? (
          <SignupForm />
        ) : (
          <Alert variant="warning" title="Registration is not configured">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env.local</code>, then restart the development server.
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}
