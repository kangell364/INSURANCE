import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/States'
import { getActiveCourses } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Courses',
  description:
    'Exam preparation courses for Texas insurance licensing examinations.',
  robots: { index: true, follow: true },
}

export default async function CoursesPage() {
  const { data: courses, error } = await getActiveCourses()

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Catalogue"
        title="Courses"
        description="Preparation courses for Texas insurance licensing examinations. More courses are added as each exam blueprint is completed."
      />

      {error && (
        <Alert variant="warning" title="Course list unavailable">
          {error}
        </Alert>
      )}

      {courses && courses.length === 0 && (
        <Card>
          <EmptyState
            title="No courses published yet"
            description="Our first course is in final preparation. Create an account and we will let you know the moment it opens."
            action={<ButtonLink href="/signup">Create an account</ButtonLink>}
          />
        </Card>
      )}

      {courses && courses.length > 0 && (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} as="li" className="flex flex-col">
              <CardBody className="flex-1">
                <h2 className="text-lg font-semibold">{course.title}</h2>
                {course.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {course.description}
                  </p>
                )}
              </CardBody>
              <CardFooter>
                <ButtonLink href="/signup" variant="secondary" size="sm">
                  Get started
                </ButtonLink>
              </CardFooter>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
