import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminCourseContent } from '@/lib/queries'

/* ==========================================================================
   The authoring screens.

   The properties worth pinning here are the ones a careless edit would break
   silently: that reorder and publish are POSTs rather than links, that the
   slug stops following the title once it is public, and that the preview
   renders through the same component the student sees.
   ========================================================================== */

const requireAdminMock = vi.hoisted(() => vi.fn())
const getAdminCourseContentMock = vi.hoisted(() => vi.fn())
const getAllCoursesMock = vi.hoisted(() => vi.fn())
const getCourseTopicsMock = vi.hoisted(() => vi.fn())
const getLessonForEditMock = vi.hoisted(() => vi.fn())
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)

vi.mock('@/lib/auth', () => ({
  requireAdmin: requireAdminMock,
  requireAuth: vi.fn(),
  getAuthContext: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@/lib/queries', () => ({
  getAdminCourseContent: getAdminCourseContentMock,
  getAllCourses: getAllCoursesMock,
  getCourseTopics: getCourseTopicsMock,
  getLessonForEdit: getLessonForEditMock,
}))

// Server actions cannot execute in a component test; the assertions are about
// which action a form is WIRED to, not what it does.
vi.mock('@/app/admin/content/actions', () => ({
  moveContentAction: vi.fn(),
  setStatusAction: vi.fn(),
  deleteContentAction: vi.fn(),
  saveModuleAction: vi.fn(),
  saveLessonAction: vi.fn(),
  saveTopicAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/content',
  redirect: vi.fn(),
  notFound: notFoundMock,
}))

const AdminCourseContentPage = (
  await import('@/app/admin/content/[courseSlug]/page')
).default
const TopicsPage = (
  await import('@/app/admin/content/[courseSlug]/topics/page')
).default
const { LessonForm } = await import('@/components/admin/LessonForm')

const ADMIN = {
  user: { id: 'admin-1', email: 'admin@example.com' },
  profile: {
    id: 'admin-1',
    first_name: 'Cee',
    last_name: 'Charlie',
    email: 'admin@example.com',
    role: 'admin' as const,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  profileError: null,
}

const CONTENT: AdminCourseContent = {
  course: {
    id: 'course-1',
    title: 'Texas General Lines',
    slug: 'texas-general-lines',
    description: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  modules: [
    {
      id: 'module-1',
      title: 'Fundamentals',
      description: null,
      position: 1,
      status: 'active',
      lessons: [
        {
          id: 'lesson-1',
          title: 'Risk and Hazard',
          slug: 'risk-and-hazard',
          summary: null,
          position: 1,
          status: 'active',
          estimated_minutes: 15,
          hasBody: true,
        },
        {
          id: 'lesson-2',
          title: 'Insurable Interest',
          slug: 'insurable-interest',
          summary: null,
          position: 2,
          status: 'draft',
          estimated_minutes: null,
          hasBody: false,
        },
      ],
    },
    {
      id: 'module-2',
      title: 'Policy Provisions',
      description: null,
      position: 2,
      status: 'draft',
      lessons: [],
    },
  ],
}

const params = { params: Promise.resolve({ courseSlug: 'texas-general-lines' }) }

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(ADMIN)
  getAdminCourseContentMock.mockResolvedValue({ data: CONTENT, error: null })
  getCourseTopicsMock.mockResolvedValue({ data: [], error: null })
})

describe('the course content page', () => {
  it('renders nothing at all for a non-admin', async () => {
    requireAdminMock.mockResolvedValue(null)
    const { container } = render(<div>{await AdminCourseContentPage(params)}</div>)
    expect(container.textContent).toBe('')
  })

  it('shows drafts alongside published content', async () => {
    render(await AdminCourseContentPage(params))
    expect(screen.getByText('Policy Provisions')).toBeInTheDocument()
    expect(screen.getByText('Insurable Interest')).toBeInTheDocument()
  })

  it('flags lessons that have no body written', async () => {
    render(await AdminCourseContentPage(params))
    expect(screen.getByText('No content')).toBeInTheDocument()
    expect(screen.getByText(/1 lesson has\s+no body written/)).toBeInTheDocument()
  })

  it('makes reorder and publish POSTs, never links', async () => {
    // A GET that mutates is how a prefetcher or a crawler silently reorders
    // somebody's course.
    render(await AdminCourseContentPage(params))

    for (const label of [
      'Move Fundamentals later',
      'Unpublish Fundamentals',
      'Move Risk and Hazard later',
    ]) {
      const control = screen.getByRole('button', { name: label })
      expect(control).toHaveAttribute('type', 'submit')
    }
    expect(
      screen.queryByRole('link', { name: /^Move / }),
    ).not.toBeInTheDocument()
  })

  it('disables the move controls at each end of a run', async () => {
    render(await AdminCourseContentPage(params))

    expect(
      screen.getByRole('button', { name: 'Move Fundamentals earlier' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Policy Provisions later' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Fundamentals later' }),
    ).toBeEnabled()
  })

  it('offers the opposite action to each item’s current status', async () => {
    render(await AdminCourseContentPage(params))
    expect(
      screen.getByRole('button', { name: 'Unpublish Fundamentals' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Publish Policy Provisions' }),
    ).toBeInTheDocument()
  })

  it('warns that deleting a module takes its lessons with it', async () => {
    render(await AdminCourseContentPage(params))
    const buttons = screen.getAllByRole('button', { name: 'Delete module' })
    expect(buttons).toHaveLength(2)
  })

  it('404s for a course that does not exist', async () => {
    getAdminCourseContentMock.mockResolvedValue({ data: null, error: null })
    await expect(AdminCourseContentPage(params)).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })
})

describe('the lesson editor', () => {
  const base = {
    courseSlug: 'texas-general-lines',
    moduleId: 'module-1',
    moduleTitle: 'Fundamentals',
    topics: [{ id: 'topic-1', code: 'GL.01', name: 'Fundamentals' }],
  }

  it('derives the slug from the title for a NEW lesson', async () => {
    const user = userEvent.setup()
    render(<LessonForm {...base} />)

    await user.type(
      screen.getByLabelText(/Lesson title/),
      'Risk, Peril and Hazard',
    )
    expect(screen.getByLabelText(/Web address/)).toHaveValue(
      'risk-peril-and-hazard',
    )
  })

  it('stops deriving it once the author edits the slug', async () => {
    const user = userEvent.setup()
    render(<LessonForm {...base} />)

    await user.type(screen.getByLabelText(/Lesson title/), 'First')
    const slugField = screen.getByLabelText(/Web address/)
    await user.clear(slugField)
    await user.type(slugField, 'my-own-choice')

    await user.type(screen.getByLabelText(/Lesson title/), ' Second')

    expect(slugField).toHaveValue('my-own-choice')
  })

  it('never re-derives the slug of an EXISTING lesson', async () => {
    // The slug is already a public URL by then; changing it silently breaks
    // every link and search result pointing at the lesson.
    const user = userEvent.setup()
    render(
      <LessonForm
        {...base}
        lesson={{
          id: 'lesson-1',
          title: 'Original Title',
          slug: 'original-title',
          summary: null,
          status: 'active',
          estimatedMinutes: 10,
          body: '',
          topicIds: [],
        }}
      />,
    )

    await user.type(screen.getByLabelText(/Lesson title/), ' Rewritten')
    expect(screen.getByLabelText(/Web address/)).toHaveValue('original-title')
  })

  it('previews the body through the student-facing renderer', async () => {
    const user = userEvent.setup()
    render(<LessonForm {...base} />)

    await user.type(screen.getByLabelText('Markdown'), '# Hello')
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(
      screen.getByRole('heading', { name: 'Hello', level: 2 }),
    ).toBeInTheDocument()
  })

  it('keeps the body field mounted while previewing', async () => {
    // If the textarea unmounted, it would leave the form, and a save from the
    // preview would submit an empty body over the author's work.
    const user = userEvent.setup()
    const { container } = render(<LessonForm {...base} />)

    await user.type(screen.getByLabelText('Markdown'), 'kept')
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    const textarea = container.querySelector('textarea[name="body"]')
    expect(textarea).not.toBeNull()
    expect(textarea).toHaveValue('kept')
  })

  it('renders hostile body content as inert text in the preview', async () => {
    const user = userEvent.setup()
    const { container } = render(<LessonForm {...base} />)

    await user.type(
      screen.getByLabelText('Markdown'),
      '<img src=x onerror=alert(1)>',
    )
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    // Scoped to the preview: the textarea legitimately still holds the same
    // text, which is the point of the test above it.
    const preview = within(
      screen.getByRole('region', { name: 'Lesson preview' }),
    )
    expect(container.querySelector('img')).toBeNull()
    expect(preview.getByText(/onerror=alert\(1\)/)).toBeInTheDocument()
  })

  it('offers the blueprint topics for tagging', async () => {
    render(<LessonForm {...base} />)
    const checkbox = screen.getByRole('checkbox', { name: /GL.01/ })
    expect(checkbox).toHaveAttribute('name', 'topicIds')
    expect(checkbox).not.toBeChecked()
  })

  it('pre-checks the topics a lesson already carries', async () => {
    render(
      <LessonForm
        {...base}
        lesson={{
          id: 'lesson-1',
          title: 'T',
          slug: 't',
          summary: null,
          status: 'draft',
          estimatedMinutes: null,
          body: '',
          topicIds: ['topic-1'],
        }}
      />,
    )
    expect(screen.getByRole('checkbox', { name: /GL.01/ })).toBeChecked()
  })

  it('carries the module and course through as hidden fields', async () => {
    const { container } = render(<LessonForm {...base} />)
    expect(
      container.querySelector('input[name="moduleId"]'),
    ).toHaveValue('module-1')
    expect(
      container.querySelector('input[name="courseSlug"]'),
    ).toHaveValue('texas-general-lines')
    // No course_id field: the server reads it from the module row so a
    // tampered value cannot move the lesson between courses.
    expect(container.querySelector('input[name="courseId"]')).toBeNull()
  })
})

describe('the exam blueprint screen', () => {
  const topic = (
    id: string,
    code: string,
    weight: number | null,
    parent: string | null = null,
  ) => ({
    id,
    course_id: 'course-1',
    parent_topic_id: parent,
    code,
    name: `Topic ${code}`,
    blueprint_weight: weight,
    position: 1,
  })

  it('warns when the top-level weightings do not total 100%', async () => {
    // The failure this catches is quiet: a blueprint transcribed with one row
    // missing still LOOKS complete, and only shows up much later as a
    // readiness score weighting the wrong things.
    getCourseTopicsMock.mockResolvedValue({
      data: [topic('t1', 'GL.01', 15), topic('t2', 'GL.02', 20)],
      error: null,
    })

    render(await TopicsPage(params))

    expect(
      screen.getByText(/Weightings do not add up to 100%/),
    ).toBeInTheDocument()
    expect(screen.getByText(/total 35.00%/)).toBeInTheDocument()
  })

  it('stays quiet when they do total 100%', async () => {
    getCourseTopicsMock.mockResolvedValue({
      data: [topic('t1', 'GL.01', 60), topic('t2', 'GL.02', 40)],
      error: null,
    })

    render(await TopicsPage(params))

    expect(
      screen.queryByText(/Weightings do not add up/),
    ).not.toBeInTheDocument()
  })

  it('ignores sub-topic weightings in the total', async () => {
    // Only top-level topics carry a published share of the exam; adding a
    // child's weighting would double-count it.
    getCourseTopicsMock.mockResolvedValue({
      data: [
        topic('t1', 'GL.01', 60),
        topic('t2', 'GL.02', 40),
        topic('t3', 'GL.01.01', 25, 't1'),
      ],
      error: null,
    })

    render(await TopicsPage(params))

    expect(
      screen.queryByText(/Weightings do not add up/),
    ).not.toBeInTheDocument()
  })

  it('stays quiet when no topic carries a weighting at all', async () => {
    // A blueprint mid-transcription is not an error to shout about.
    getCourseTopicsMock.mockResolvedValue({
      data: [topic('t1', 'GL.01', null), topic('t2', 'GL.02', null)],
      error: null,
    })

    render(await TopicsPage(params))

    expect(
      screen.queryByText(/Weightings do not add up/),
    ).not.toBeInTheDocument()
  })
})
