import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getAllCourses } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'

export const metadata: Metadata = { title: 'Content' }

export default async function AdminContentPage() {
  // Re-checked here, not inherited from the layout, so the page is safe on its
  // own terms.
  const context = await requireAdmin()
  if (!context) return null

  const { data: courses, error } = await getAllCourses()

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Course content"
        description="Choose a course to edit its modules, lessons and exam blueprint."
      />

      {error && (
        <Alert variant="warning" title="Courses unavailable">
          {error}
        </Alert>
      )}

      {courses && courses.length === 0 && (
        <Card>
          <EmptyState
            title="No courses yet"
            description="Courses are created in SQL for now. Once one exists it appears here with its modules and lessons."
          />
        </Card>
      )}

      {courses && courses.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {courses.map((course) => (
            <Card key={course.id} as="li">
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">
                    <Link
                      href={`/admin/content/${course.slug}`}
                      className="text-navy-800 hover:text-navy-950 hover:underline"
                    >
                      {course.title}
                    </Link>
                  </h2>
                  <Badge
                    tone={course.status === 'active' ? 'success' : 'neutral'}
                  >
                    {course.status === 'active' ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {course.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {course.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <Link
                    href={`/admin/content/${course.slug}`}
                    className="font-medium text-navy-700 hover:underline"
                  >
                    Modules and lessons
                  </Link>
                  <Link
                    href={`/admin/content/${course.slug}/topics`}
                    className="font-medium text-navy-700 hover:underline"
                  >
                    Exam blueprint
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </>
  )
}
