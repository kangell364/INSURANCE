import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const resetMock = vi.hoisted(() => vi.fn())
const updateUserMock = vi.hoisted(() => vi.fn())
const getSessionMock = vi.hoisted(() => vi.fn())
const onAuthStateChangeMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: resetMock,
      updateUser: updateUserMock,
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const { ForgotPasswordForm } = await import(
  '@/components/auth/ForgotPasswordForm'
)
const { ResetPasswordForm } = await import(
  '@/components/auth/ResetPasswordForm'
)

beforeEach(() => {
  vi.clearAllMocks()
  resetMock.mockResolvedValue({ error: null })
  updateUserMock.mockResolvedValue({ error: null })
  getSessionMock.mockResolvedValue({ data: { session: { user: {} } } })
  onAuthStateChangeMock.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
})

describe('ForgotPasswordForm', () => {
  it('sends a reset email for a valid address', async () => {
    render(<ForgotPasswordForm />)
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'duane@example.test',
    )
    await userEvent.click(screen.getByRole('button', { name: /send reset/i }))

    await waitFor(() => expect(resetMock).toHaveBeenCalledTimes(1))
    expect(resetMock.mock.calls[0][0]).toBe('duane@example.test')
    expect(resetMock.mock.calls[0][1].redirectTo).toContain('/reset-password')
  })

  // The security property. A form that says "no account with that email" lets
  // anybody test addresses against the customer list.
  it('shows the same confirmation when the address is not registered', async () => {
    resetMock.mockResolvedValue({
      error: { message: 'User not found', status: 400 },
    })

    render(<ForgotPasswordForm />)
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'stranger@example.test',
    )
    await userEvent.click(screen.getByRole('button', { name: /send reset/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
  })

  // ...but a rate limit is about the REQUEST, not the account, so hiding it
  // only leaves the user pressing a button that will not work.
  it('surfaces a rate limit rather than pretending it sent', async () => {
    resetMock.mockResolvedValue({
      error: { message: 'Email rate limit exceeded', status: 429 },
    })

    render(<ForgotPasswordForm />)
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'duane@example.test',
    )
    await userEvent.click(screen.getByRole('button', { name: /send reset/i }))

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
  })

  it('rejects a malformed address without calling Supabase', async () => {
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: /send reset/i }))

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument()
    expect(resetMock).not.toHaveBeenCalled()
  })
})

describe('ResetPasswordForm', () => {
  it('sets a new password when the recovery session is valid', async () => {
    render(<ResetPasswordForm />)
    const password = await screen.findByLabelText(/^new password/i)

    await userEvent.type(password, 'a-strong-passphrase')
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      'a-strong-passphrase',
    )
    await userEvent.click(screen.getByRole('button', { name: /set new/i }))

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1))
    expect(updateUserMock.mock.calls[0][0]).toEqual({
      password: 'a-strong-passphrase',
    })
  })

  it('refuses a mismatched confirmation without calling Supabase', async () => {
    render(<ResetPasswordForm />)
    const password = await screen.findByLabelText(/^new password/i)

    await userEvent.type(password, 'a-strong-passphrase')
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      'a-different-one',
    )
    await userEvent.click(screen.getByRole('button', { name: /set new/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('refuses a short password', async () => {
    render(<ResetPasswordForm />)
    const password = await screen.findByLabelText(/^new password/i)

    await userEvent.type(password, 'short')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /set new/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  // Without this, somebody who navigates here directly sees a password form
  // that cannot work -- and anyone left signed in on a shared machine would
  // find a form that changes their password without asking for the old one.
  it('shows an expired-link message when there is no recovery session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })

    render(<ResetPasswordForm />)

    expect(
      await screen.findByText(/no longer valid/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/^new password/i)).not.toBeInTheDocument()
  })
})
