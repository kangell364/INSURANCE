import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { ProfileForm } from '@/components/profile/ProfileForm'

export const metadata: Metadata = { title: 'Profile' }

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Administrator',
}

export default async function ProfilePage() {
  const { user, profile, profileError } = await requireAuth()

  if (!profile) {
    return (
      <>
        <PageHeader title="Profile" />
        <Alert variant="error" title="We could not load your profile">
          {profileError ??
            'Your profile record could not be found. Please contact support so we can restore it.'}
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details."
      />

      <Card>
        <CardHeader
          title="Personal details"
          description="Keep your name up to date — it appears on your progress records."
        />
        <CardBody>
          <ProfileForm
            firstName={profile.first_name ?? ''}
            lastName={profile.last_name ?? ''}
            email={profile.email || user.email || ''}
            role={ROLE_LABELS[profile.role] ?? profile.role}
          />
        </CardBody>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Security"
            description="Password and sign-in settings."
          />
          <CardBody>
            <p className="text-sm text-slate-600">
              Password changes and email address updates are handled through
              your sign-in credentials and will be available from this page in
              a later release.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
