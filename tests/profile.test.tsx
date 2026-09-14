import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/* ==========================================================================
   Profile editing.

   Two halves: the Server Action that performs the write, and the form that
   calls it. The action is where the security rules live, so it gets the
   closer scrutiny.
   ========================================================================== */

const getUserMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())
const eqMock = vi.hoisted(() => vi.fn())
const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ getUser: getUserMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      expect(table).toBe('profiles')
      return { update: updateMock }
    },
  })),
}))

const { initialProfileFormState, updateProfileAction } = await import(
  '@/app/dashboard/profile/actions'
)
const { ProfileForm } = await import('@/components/profile/ProfileForm')

const USER = { id: 'student-1', email: 'ada@example.com' }

function formDataOf(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue(USER)
  eqMock.mockResolvedValue({ error: null })
  updateMock.mockReturnValue({ eq: eqMock })
})

describe('updateProfileAction', () => {
  it('saves trimmed first and last names for the signed-in user', async () => {
    const result = await updateProfileAction(
      initialProfileFormState,
      formDataOf({ firstName: '  Adeline  ', lastName: ' Alpher ' }),
    )

    expect(updateMock).toHaveBeenCalledWith({
      first_name: 'Adeline',
      last_name: 'Alpher',
    })
    expect(eqMock).toHaveBeenCalledWith('id', USER.id)
    expect(result.status).toBe('success')
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard', 'layout')
  })

  it('ignores a role submitted in the form', async () => {
    await updateProfileAction(
      initialProfileFormState,
      formDataOf({
        firstName: 'Ada',
        lastName: 'Alpha',
        role: 'admin',
      }),
    )

    const payload = updateMock.mock.calls[0][0]
    expect(payload).toEqual({ first_name: 'Ada', last_name: 'Alpha' })
    expect(payload).not.toHaveProperty('role')
  })

  it('ignores an id submitted in the form and uses the session id', async () => {
    await updateProfileAction(
      initialProfileFormState,
      formDataOf({
        firstName: 'Ada',
        lastName: 'Alpha',
        id: 'someone-else',
      }),
    )

    expect(eqMock).toHaveBeenCalledWith('id', USER.id)
    expect(eqMock).not.toHaveBeenCalledWith('id', 'someone-else')
  })

  it('ignores an email submitted in the form', async () => {
    await updateProfileAction(
      initialProfileFormState,
      formDataOf({
        firstName: 'Ada',
        lastName: 'Alpha',
        email: 'attacker@example.com',
      }),
    )

    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('email')
  })

  it('validates on the server and writes nothing when invalid', async () => {
    const result = await updateProfileAction(
      initialProfileFormState,
      formDataOf({ firstName: '   ', lastName: '' }),
    )

    expect(result.status).toBe('error')
    expect(result.fieldErrors.firstName).toBeDefined()
    expect(result.fieldErrors.lastName).toBeDefined()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses to write for an expired session', async () => {
    getUserMock.mockResolvedValue(null)

    const result = await updateProfileAction(
      initialProfileFormState,
      formDataOf({ firstName: 'Ada', lastName: 'Alpha' }),
    )

    expect(result.status).toBe('error')
    expect(result.message).toMatch(/session has expired/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('reports a database failure without leaking the driver message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    eqMock.mockResolvedValue({
      error: { code: '42501', message: 'permission denied for table profiles' },
    })

    const result = await updateProfileAction(
      initialProfileFormState,
      formDataOf({ firstName: 'Ada', lastName: 'Alpha' }),
    )

    expect(result.status).toBe('error')
    expect(result.message).toBe(
      'We could not save your changes. Please try again.',
    )
    expect(result.message).not.toContain('permission denied')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('ProfileForm', () => {
  const props = {
    firstName: 'Ada',
    lastName: 'Alpha',
    email: 'ada@example.com',
    role: 'Student',
  }

  it('pre-fills the editable name fields', () => {
    render(<ProfileForm {...props} />)

    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada')
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Alpha')
  })

  it('shows email and account type as read-only text, not as inputs', () => {
    render(<ProfileForm {...props} />)

    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('Student')).toBeInTheDocument()

    // The only editable controls are the two name fields.
    const textboxes = screen.getAllByRole('textbox')
    expect(textboxes).toHaveLength(2)
  })

  it('offers no control for changing the role', () => {
    render(<ProfileForm {...props} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: /account type/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /administrator/i }),
    ).not.toBeInTheDocument()
  })

  it('submits the form to the server action', async () => {
    const user = userEvent.setup()
    render(<ProfileForm {...props} />)

    await user.clear(screen.getByLabelText(/first name/i))
    await user.type(screen.getByLabelText(/first name/i), 'Adeline')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][0].first_name).toBe('Adeline')
  })
})
