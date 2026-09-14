import { describe, expect, it } from 'vitest'
import {
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  ROLES,
  displayName,
  enrollmentStatusLabel,
  fullName,
  isAdminRole,
} from '@/types'

describe('enumerations match the database', () => {
  // These arrays must stay in step with the enum types created in
  // supabase/migrations/20260101000000_types_and_helpers.sql.
  it('has exactly the three roles', () => {
    expect(ROLES).toEqual(['student', 'instructor', 'admin'])
  })

  it('has exactly the three course statuses', () => {
    expect(COURSE_STATUSES).toEqual(['draft', 'active', 'archived'])
  })

  it('has exactly the four enrollment statuses', () => {
    expect(ENROLLMENT_STATUSES).toEqual([
      'active',
      'completed',
      'expired',
      'cancelled',
    ])
  })
})

describe('isAdminRole', () => {
  it('is true only for admin', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('instructor')).toBe(false)
    expect(isAdminRole('student')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
  })
})

describe('displayName', () => {
  const base = { first_name: null, last_name: null, email: 'ada@example.com' }

  it('prefers the first name', () => {
    expect(
      displayName({ ...base, first_name: 'Ada', last_name: 'Alpha' }),
    ).toBe('Ada')
  })

  it('falls back to the last name', () => {
    expect(displayName({ ...base, last_name: 'Alpha' })).toBe('Alpha')
  })

  it('falls back to the email local part', () => {
    expect(displayName(base)).toBe('ada')
  })

  it('never renders an empty greeting', () => {
    expect(displayName(null)).toBe('there')
    expect(displayName({ first_name: '   ', last_name: '', email: '' })).toBe(
      'there',
    )
  })
})

describe('fullName', () => {
  it('joins both names', () => {
    expect(fullName({ first_name: 'Ada', last_name: 'Alpha' })).toBe(
      'Ada Alpha',
    )
  })

  it('omits a missing half without leaving stray whitespace', () => {
    expect(fullName({ first_name: 'Ada', last_name: null })).toBe('Ada')
    expect(fullName({ first_name: null, last_name: 'Alpha' })).toBe('Alpha')
    expect(fullName({ first_name: null, last_name: null })).toBe('')
    expect(fullName(null)).toBe('')
  })
})

describe('enrollmentStatusLabel', () => {
  it('gives every status a human label', () => {
    for (const status of ENROLLMENT_STATUSES) {
      expect(enrollmentStatusLabel(status)).toMatch(/^[A-Z]/)
    }
  })
})
