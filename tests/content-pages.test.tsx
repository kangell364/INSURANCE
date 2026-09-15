import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CourseOutline, LessonWithContent } from '@/types'

/* ==========================================================================
   The content pages.

   The security property these guard is narrow and specific: the page that
   renders a lesson body must render NOTHING when the database withheld it,
   and the public syllabus page must never ask for a body at all.
   ========================================================================== */

const requireAuthMock = vi.hoisted(() => vi.fn())
const getCourseOutlineMock = vi.hoisted(() => vi.fn())
const getLessonWithContentMock = vi.hoisted(() => vi.fn())
const getTopicTreeMock = vi.hoisted(() => vi.fn())
const getMyEnrollmentForCourseSlugMock = vi.hoisted(() => vi.fn())
const hasLiveEnrollmentMock = vi.hoisted(() => vi.fn())
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    // The real notFound() throws to unwind rendering. Mirroring that is what
    // makes "this page 404s" testable at all.
    throw new Error('NEXT_NOT_FOUND')
  }),
)

vi.mock('@/lib/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: vi.fn(),
  getAuthContext: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@/lib/queries', () => ({
  getCourseOutline: getCourseOutlineMock,
  getLessonWithContent: getLessonWithContentMock,
  getTopicTree: getTopicTreeMock,
  getMyEnrollmentForCourseSlug: getMyEnrollmentForCourseSlugMock,
  hasLiveEnrollment: hasLiveEnrollmentMock,
  getActiveCourses: vi.fn(),
  getMyEnrollments: vi.fn(),
  getAdminCounts: vi.fn(),
  getContentCounts: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  redirect: vi.fn(),
  notFound: notFoundMock,
}))

const CourseDetailPage = (await import('@/app/(marketing)/courses/[slug]/page'))
  .default
const DashboardCoursePage = (
  await import('@/app/dashboard/courses/[courseSlug]/page')
).default
const LessonPage = (
  await import('@/app/dashboard/courses/[courseSlug]/[lessonSlug]/page')
).default

const STUDENT = {
  user: { id: 'student-1', email: 'ada@example.com' },
  profile: {
    id: 'student-1',
    first_name: 'Ada',
    last_name: 'Alpha',
    email: 'ada@example.com',
    role: 'student' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  profileError: null,
}

const OUTLINE: CourseOutline = {
  course: {
    id: 'course-1',
    title: 'Texas General Lines',
    slug: 'texas-general-lines',
    description: 'Everything on the exam.',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  modules: [
    {
      id: 'module-1',
      title: 'Insurance Fundamentals',
      description: 'The vocabulary.',
      position: 1,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Risk, Peril and Hazard',
          slug: 'risk-peril-and-hazard',
          summary: 'Three words.',
          position: 1,
          estimated_minutes: 15,
        },
        {
          id: 'lesson-2',
          title: 'Insurable Interest',
          slug: 'insurable-interest',
          summary: null,
          position: 2,
          estimated_minutes: 12,
        },
      ],
    },
  ],
  estimatedMinutes: 27,
  lessonCount: 2,
}

const LESSON: LessonWithContent = {
  id: 'lesson-1',
  title: 'Risk, Peril and Hazard',
  slug: 'risk-peril-and-hazard',
  summary: 'Three words.',
  position: 1,
  estimated_minutes: 15,
  moduleId: 'module-1',
  moduleTitle: 'Insurance Fundamentals',
  courseId: 'course-1',
  courseSlug: 'texas-general-lines',
  courseTitle: 'Texas General Lines',
  body: '# Heading\n\nA **paid** paragraph.',
  topics: [{ id: 'topic-1', code: 'GL.01.01', name: 'Risk and hazard' }],
}

const courseParams = { params: Promise.resolve({ slug: 'texas-general-lines' }) }
const lessonParams = {
  params: Promise.resolve({
    courseSlug: 'texas-general-lines',
    lessonSlug: 'risk-peril-and-hazard',
  }),
}
const dashCourseParams = {
  params: Promise.resolve({ courseSlug: 'texas-general-lines' }),
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue(STUDENT)
  getCourseOutlineMock.mockResolvedValue({ data: OUTLINE, error: null })
  getTopicTreeMock.mockResolvedValue({ data: [], error: null })
  getMyEnrollmentForCourseSlugMock.mockResolvedValue({
    data: null,
    error: null,
  })
  hasLiveEnrollmentMock.mockResolvedValue(false)
})

describe('public course syllabus', () => {
  it('renders every published module and lesson title', async () => {
    render(await CourseDetailPage(courseParams))

    expect(
      screen.getByRole('heading', { name: 'Texas General Lines' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Risk, Peril and Hazard')).toBeInTheDocument()
    expect(screen.getByText('Insurable Interest')).toBeInTheDocument()
  })

  it('never requests a lesson body', async () => {
    // The strongest form of "the syllabus cannot leak the content": there is
    // no call that could return it.
    render(await CourseDetailPage(courseParams))
    expect(getLessonWithContentMock).not.toHaveBeenCalled()
  })

  it('shows the total study time', async () => {
    render(await CourseDetailPage(courseParams))
    expect(screen.getByText('27 min')).toBeInTheDocument()
  })

  it('404s for an unknown course', async () => {
    getCourseOutlineMock.mockResolvedValue({ data: null, error: null })
    await expect(CourseDetailPage(courseParams)).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })

  it('shows the error rather than a blank page when the query fails', async () => {
    getCourseOutlineMock.mockResolvedValue({ data: null, error: 'Boom' })
    render(await CourseDetailPage(courseParams))
    expect(screen.getByText('Boom')).toBeInTheDocument()
  })
})

describe('the student course page', () => {
  it('links to each lesson when the enrollment is live', async () => {
    hasLiveEnrollmentMock.mockResolvedValue(true)

    render(await DashboardCoursePage(dashCourseParams))

    expect(
      screen.getByRole('link', { name: 'Risk, Peril and Hazard' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/courses/texas-general-lines/risk-peril-and-hazard',
    )
  })

  it('does not link to lessons without a live enrollment', async () => {
    hasLiveEnrollmentMock.mockResolvedValue(false)

    render(await DashboardCoursePage(dashCourseParams))

    expect(screen.getByText('Risk, Peril and Hazard')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Risk, Peril and Hazard' }),
    ).not.toBeInTheDocument()
  })

  it('asks the database about entitlement rather than reading the row', async () => {
    // Guards the fix for a duplicated definition of "live enrollment": an
    // expired row with status 'active' must not be treated as access.
    getMyEnrollmentForCourseSlugMock.mockResolvedValue({
      data: {
        id: 'e1',
        student_id: 'student-1',
        course_id: 'course-1',
        status: 'active',
        enrolled_at: '2020-01-01T00:00:00Z',
        expires_at: '2021-01-01T00:00:00Z',
        course: OUTLINE.course,
      },
      error: null,
    })
    hasLiveEnrollmentMock.mockResolvedValue(false)

    render(await DashboardCoursePage(dashCourseParams))

    expect(hasLiveEnrollmentMock).toHaveBeenCalledWith('course-1')
    expect(
      screen.queryByRole('link', { name: 'Risk, Peril and Hazard' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/access to this course is not active/i)).toBeInTheDocument()
  })
})

describe('the lesson reader', () => {
  it('renders the body for an entitled student', async () => {
    getLessonWithContentMock.mockResolvedValue({ data: LESSON, error: null })

    render(await LessonPage(lessonParams))

    expect(
      screen.getByRole('heading', { name: 'Risk, Peril and Hazard', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Heading', level: 2 }))
      .toBeInTheDocument()
    expect(screen.getByText('paid')).toBeInTheDocument()
  })

  it('renders the blueprint topics the lesson covers', async () => {
    getLessonWithContentMock.mockResolvedValue({ data: LESSON, error: null })
    render(await LessonPage(lessonParams))
    expect(screen.getByText('Risk and hazard')).toBeInTheDocument()
  })

  it('offers the next lesson', async () => {
    getLessonWithContentMock.mockResolvedValue({ data: LESSON, error: null })
    render(await LessonPage(lessonParams))
    expect(
      screen.getByRole('link', { name: /Insurable Interest/ }),
    ).toHaveAttribute(
      'href',
      '/dashboard/courses/texas-general-lines/insurable-interest',
    )
  })

  it('renders NO body when the database withheld it', async () => {
    getLessonWithContentMock.mockResolvedValue({ data: null, error: null })

    render(await LessonPage(lessonParams))

    expect(screen.queryByText('paid')).not.toBeInTheDocument()
    expect(
      screen.getByText(/lesson is for enrolled students/i),
    ).toBeInTheDocument()
  })

  it('distinguishes a lapsed enrollment from never having enrolled', async () => {
    getLessonWithContentMock.mockResolvedValue({ data: null, error: null })
    getMyEnrollmentForCourseSlugMock.mockResolvedValue({
      data: {
        id: 'e1',
        student_id: 'student-1',
        course_id: 'course-1',
        status: 'expired',
        enrolled_at: '2020-01-01T00:00:00Z',
        expires_at: '2021-01-01T00:00:00Z',
        course: OUTLINE.course,
      },
      error: null,
    })

    render(await LessonPage(lessonParams))

    expect(
      screen.getByText(/access to this course is not active/i),
    ).toBeInTheDocument()
  })

  it('404s for a lesson that is not in the public outline at all', async () => {
    // A withheld body plus a slug nobody can see is indistinguishable from a
    // typo, and must not confirm that the lesson exists.
    getLessonWithContentMock.mockResolvedValue({ data: null, error: null })
    getCourseOutlineMock.mockResolvedValue({
      data: { ...OUTLINE, modules: [], lessonCount: 0 },
      error: null,
    })

    await expect(LessonPage(lessonParams)).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
