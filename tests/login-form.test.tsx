import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signInMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword: signInMock } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  useSearchParams: () => searchParams.current,
}))

const { LoginForm } = await import('@/components/auth/LoginForm')

async function signIn(
  user: ReturnType<typeof userEvent.setup>,
  email = 'ada@example.com',
  password = 'correct-horse',
) {
  await user.type(screen.getByLabelText(/email address/i), email)
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  searchParams.current = new URLSearchParams()
})

describe('LoginForm', () => {
  it('requires an email address and a password', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed email address before calling the auth service', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await signIn(user, 'not-an-email')

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('signs in and lands on the dashboard', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({ data: { session: {} }, error: null })

    render(<LoginForm />)
    await signIn(user)

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-horse',
      })
    })
    expect(replaceMock).toHaveBeenCalledWith('/dashboard')
    // refresh() re-runs the Server Components so the header updates.
    expect(refreshMock).toHaveBeenCalled()
  })

  it('returns the user to the protected page they were heading for', async () => {
    const user = userEvent.setup()
    searchParams.current = new URLSearchParams('next=/dashboard/profile')
    signInMock.mockResolvedValue({ data: { session: {} }, error: null })

    render(<LoginForm />)
    await signIn(user)

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/profile'),
    )
  })

  it('refuses to redirect off-site after sign in', async () => {
    const user = userEvent.setup()
    searchParams.current = new URLSearchParams(
      'next=https://evil.example.com/harvest',
    )
    signInMock.mockResolvedValue({ data: { session: {} }, error: null })

    render(<LoginForm />)
    await signIn(user)

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/dashboard'))
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining('evil.example.com'),
    )
  })

  it('shows a non-enumerating error for bad credentials', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    })

    render(<LoginForm />)
    await signIn(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'That email address and password combination is not correct.',
    )
    // Must not distinguish "no such user" from "wrong password".
    expect(alert.textContent?.toLowerCase()).not.toMatch(
      /no account|not found|does not exist/,
    )
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('tells the user when their email is unconfirmed', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email not confirmed' },
    })

    render(<LoginForm />)
    await signIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /confirm your email address/i,
    )
  })

  it('confirms a fresh registration when arriving from signup', () => {
    searchParams.current = new URLSearchParams('registered=1')
    render(<LoginForm />)

    expect(screen.getByText(/account created/i)).toBeInTheDocument()
  })

  it('handles a network failure without navigating', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    signInMock.mockRejectedValue(new Error('offline'))

    render(<LoginForm />)
    await signIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not reach the authentication service/i,
    )
    expect(replaceMock).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
