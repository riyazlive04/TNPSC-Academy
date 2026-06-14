import { describe, it, expect } from 'vitest'
import { selectIsAdmin, selectIsSuperAdmin, selectRole, type AuthState } from '../store/authStore'
import { isValidEmail, friendlyAuthError, passwordStrength } from '../lib/authValidation'
import type { Profile, UserRole } from '../types'

/** Build a minimal AuthState carrying just a role for selector tests. */
const stateWithRole = (role?: UserRole): AuthState =>
  ({
    user: role ? { id: 'u1' } : null,
    profile: role ? ({ id: 'u1', full_name: 'X', email: 'x@y.z', role } as Profile) : null,
  }) as unknown as AuthState

describe('role selectors', () => {
  it('treats admin and superadmin as admin (inheritance)', () => {
    expect(selectIsAdmin(stateWithRole('admin'))).toBe(true)
    expect(selectIsAdmin(stateWithRole('superadmin'))).toBe(true)
  })

  it('does not treat a plain user as admin', () => {
    expect(selectIsAdmin(stateWithRole('user'))).toBe(false)
    expect(selectIsAdmin(stateWithRole(undefined))).toBe(false)
  })

  it('selectIsSuperAdmin is true ONLY for superadmin', () => {
    expect(selectIsSuperAdmin(stateWithRole('superadmin'))).toBe(true)
    expect(selectIsSuperAdmin(stateWithRole('admin'))).toBe(false)
    expect(selectIsSuperAdmin(stateWithRole('user'))).toBe(false)
  })

  it('selectRole defaults to user when no profile', () => {
    expect(selectRole(stateWithRole(undefined))).toBe('user')
    expect(selectRole(stateWithRole('superadmin'))).toBe('superadmin')
  })
})

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail(' aspirant@email.com ')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('friendlyAuthError', () => {
  it('maps infra/config/network noise to a generic key (no leaks)', () => {
    expect(friendlyAuthError('API is not configured. Set VITE_API_URL').key).toBe('errServerUnreachable')
    expect(friendlyAuthError('Failed to fetch').key).toBe('errServerUnreachable')
    expect(friendlyAuthError(null).key).toBe('errServerUnreachable')
    expect(friendlyAuthError('Request failed with 503').key).toBe('errServerUnreachable')
  })
  it('passes through meaningful auth messages', () => {
    expect(friendlyAuthError('Invalid login credentials').text).toBe('Invalid login credentials')
    expect(friendlyAuthError('Email not confirmed').text).toBe('Email not confirmed')
  })
})

describe('passwordStrength', () => {
  it('scores from weak to strong', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('abcdef')).toBe(1)
    expect(passwordStrength('Abcdef1')).toBeGreaterThanOrEqual(2)
    expect(passwordStrength('Abcdefgh12!')).toBe(4)
  })
})
