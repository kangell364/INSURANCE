import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signUpMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  useSearchParams: () => new URLSearchParams(),
}))

const { SignupForm } = await import('@/components/auth/SignupForm')

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Ada')
  await user.type(screen.getByLabelText(/last name/i), 'Alpha')
  await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/^password/i), 'correct-horse')
  await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', window)
})

describe('SignupForm', () => {
  it('renders exactly the five required fields and no role selector', () => {
    render(<SignupForm />)

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()

    // Public registration must not offer a role. If one is ever added to this
    // form, this assertion fails before the code reaches review.
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/administrator|instructor/i)).not.toBeInTheDocument()
  })

  it('blocks submission and shows an error for every empty field', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your last name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Choose a password.')).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rejects a mismatched password confirmation', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/first name/i), 'Ada')
    await user.type(screen.getByLabelText(/last name/i), 'Alpha')
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rejects a short password', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/first name/i), 'Ada')
    await user.type(screen.getByLabelText(/last name/i), 'Alpha')
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText(/at least 8 characters/i),
    ).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('submits only name metadata — never a role', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'u1' } },
      error: null,
    })

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signUpMock).toHaveBeenCalledTimes(1))

    const payload = signUpMock.mock.calls[0][0]
    expect(payload.email).toBe('ada@example.com')
    expect(payload.options.data).toEqual({
      first_name: 'Ada',
      last_name: 'Alpha',
    })
    expect(payload.options.data).not.toHaveProperty('role')
  })

  it('sends the user to the dashboard when a session is returned', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'u1' } },
      error: null,
    })

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows a neutral confirmation screen when email confirmation is required', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: 'u1' } },
      error: null,
    })

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // "If that address can be registered" — deliberately non-committal, so the
    // screen cannot be used to discover whether an account already exists.
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/if that address can be registered/i)).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows a safe message when Supabase rejects the signup', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    })

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not create that account/i)
    expect(alert.textContent?.toLowerCase()).not.toMatch(/already registered/)
  })

  it('recovers from a network failure without losing the form', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    signUpMock.mockRejectedValue(new Error('network down'))

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not reach the authentication service/i,
    )
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada')
    consoleError.mockRestore()
  })
})
