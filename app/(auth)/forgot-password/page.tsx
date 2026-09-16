import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardBody className="py-8">
        <h1 className="text-xl">Reset your password</h1>
        <p className="mt-1.5 mb-6 text-sm text-slate-600">
          We will email you a link to choose a new one.
        </p>

        {isSupabaseConfigured() ? (
          <ForgotPasswordForm />
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
