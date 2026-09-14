import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/* ==========================================================================
   Server Component rendering.

   These are async Server Components, so they are awaited to produce an element
   tree and that tree is rendered. Their data sources are mocked, which is the
   point: the behaviour under test is what the page renders for a student with
   enrollments, for one without, and when the query fails.
   ========================================================================== */

const requireAuthMock = vi.hoisted(() => vi.fn())
const requireAdminMock = vi.hoisted(() => vi.fn())
const getMyEnrollmentsMock = vi.hoisted(() => vi.fn())
const getAdminCountsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
  getAuthContext: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@/lib/queries', () => ({
  getMyEnrollments: getMyEnrollmentsMock,
  getAdminCounts: getAdminCountsMock,
  getActiveCourses: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  redirect: vi.fn(),
}))

const DashboardPage = (await import('@/app/dashboard/page')).default
const MyCoursesPage = (await import('@/app/dashboard/courses/page')).default
const AdminLayout = (await import('@/app/admin/layout')).default
const AdminPage = (await import('@/app/admin/page')).default

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

const ENROLLMENT = {
  id: 'enrollment-1',
  student_id: 'student-1',
  course_id: 'course-1',
  status: 'active' as const,
  enrolled_at: '2026-02-01T00:00:00Z',
  expires_at: null,
  course: {
    id: 'course-1',
    title: 'Texas General Lines Property & Casualty Exam Prep',
    slug: 'texas-general-lines-property-casualty',
    description: 'Complete preparation for the Texas licensing examination.',
    status: 'active' as const,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuthMock.mockResolvedValue(STUDENT)
})

describe('/dashboard', () => {
  it('greets the student by their first name', async () => {
    getMyEnrollmentsMock.mockResolvedValue({ data: [], error: null })

    render(await DashboardPage())

    expect(
      screen.getByRole('heading', { name: /welcome back, ada/i }),
    ).toBeInTheDocument()
  })

  it('shows an empty state, not a broken panel, when there are no enrollments', async () => {
    getMyEnrollmentsMock.mockResolvedValue({ data: [], error: null })

    render(await DashboardPage())

    expect(
      screen.getByText(/you are not enrolled in a course yet/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /browse the catalogue/i }),
    ).toHaveAttribute('href', '/courses')
  })

  it('lists the enrolled course and its status', async () => {
    getMyEnrollmentsMock.mockResolvedValue({
      data: [ENROLLMENT],
      error: null,
    })

    render(await DashboardPage())

    expect(
      screen.getAllByText(/texas general lines property & casualty/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('reports a data failure instead of rendering an empty dashboard', async () => {
    getMyEnrollmentsMock.mockResolvedValue({
      data: null,
      error: 'We could not load this information right now.',
    })

    render(await DashboardPage())

    expect(
      screen.getByText(/could not load this information/i),
    ).toBeInTheDocument()
  })

  it('marks unbuilt sections as placeholders rather than showing invented figures', async () => {
    getMyEnrollmentsMock.mockResolvedValue({ data: [], error: null })

    render(await DashboardPage())

    expect(screen.getByText(/overall progress/i)).toBeInTheDocument()
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0)
    // Readiness must read as "not measured", never as a number.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })
})

describe('/dashboard/courses', () => {
  it('shows the empty state when the student has no enrollments', async () => {
    getMyEnrollmentsMock.mockResolvedValue({ data: [], error: null })

    render(await MyCoursesPage())

    expect(
      screen.getByText(/you are not enrolled in any courses/i),
    ).toBeInTheDocument()
  })

  it('renders a card per enrollment with title and status', async () => {
    getMyEnrollmentsMock.mockResolvedValue({ data: [ENROLLMENT], error: null })

    render(await MyCoursesPage())

    expect(
      screen.getByRole('heading', {
        name: /texas general lines property & casualty/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/enrolled/i)).toBeInTheDocument()
  })

  it('degrades gracefully when RLS hides the joined course row', async () => {
    // An enrollment in a course that was moved back to draft: the enrollment
    // is visible, the course is not. The page must not crash.
    getMyEnrollmentsMock.mockResolvedValue({
      data: [{ ...ENROLLMENT, course: null }],
      error: null,
    })

    render(await MyCoursesPage())

    expect(screen.getByText(/course unavailable/i)).toBeInTheDocument()
  })

  it('surfaces a query failure', async () => {
    getMyEnrollmentsMock.mockResolvedValue({
      data: null,
      error: 'We could not load this information right now.',
    })

    render(await MyCoursesPage())

    expect(screen.getByText(/courses unavailable/i)).toBeInTheDocument()
  })
})

describe('/admin', () => {
  it('shows access denied to a non-admin and renders none of the admin children', async () => {
    // requireAdmin() returns null for any signed-in non-admin.
    requireAdminMock.mockResolvedValue(null)

    render(
      await AdminLayout({
        children: <p>TOP SECRET ADMIN CONTENT</p>,
      }),
    )

    expect(
      screen.getByRole('heading', { name: /access denied/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('TOP SECRET ADMIN CONTENT'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /go to my dashboard/i }),
    ).toHaveAttribute('href', '/dashboard')
  })

  it('renders the shell for an admin', async () => {
    requireAdminMock.mockResolvedValue({
      ...STUDENT,
      profile: { ...STUDENT.profile, role: 'admin' as const },
    })

    render(await AdminLayout({ children: <p>Admin content</p> }))

    expect(screen.getByText('Admin content')).toBeInTheDocument()
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument()
  })

  it('re-checks admin status on the page itself, not only in the layout', async () => {
    requireAdminMock.mockResolvedValue(null)
    getAdminCountsMock.mockResolvedValue({ data: null, error: null })

    const { container } = render(<div>{await AdminPage()}</div>)

    // The page renders nothing at all rather than trusting its parent.
    expect(container.textContent).toBe('')
  })

  it('lists every planned management area, labelled with its phase', async () => {
    requireAdminMock.mockResolvedValue({
      ...STUDENT,
      profile: { ...STUDENT.profile, role: 'admin' as const },
    })
    getAdminCountsMock.mockResolvedValue({
      data: { students: 3, courses: 1, enrollments: 2 },
      error: null,
    })

    render(await AdminPage())

    for (const section of [
      'Courses',
      'Modules',
      'Lessons',
      'Question bank',
      'Exam blueprints',
      'Students',
      'Instructors',
      'Reports',
      'Settings',
    ]) {
      expect(
        screen.getByRole('heading', { name: section }),
      ).toBeInTheDocument()
    }

    expect(screen.getAllByText(/^Phase \d$/).length).toBe(9)
  })
})
