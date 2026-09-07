import { describe, it, expect } from 'vitest'
import {
  selectIsAdmin,
  selectIsCrmStaff,
  selectIsTelecaller,
  selectProfileNeedsOnboarding,
  type AuthState,
} from '../store/authStore'
import {
  SLA_BREACH_SECS,
  SLA_TARGET_SECS,
  SLA_WARN_SECS,
  formatDuration,
  mailLink,
  parseLeadCsv,
  slaState,
  telLink,
  tenDigit,
  whatsappLink,
  type Lead,
} from '../lib/crm'
import type { Profile, UserRole } from '../types'

const stateWithRole = (role?: UserRole): AuthState =>
  ({
    user: role ? { id: 'u1' } : null,
    profile: role ? ({ id: 'u1', full_name: 'X', email: 'x@y.z', role } as Profile) : null,
  }) as unknown as AuthState

describe('telecaller role', () => {
  it('is CRM staff but NOT an admin', () => {
    // The whole point of the fourth role: it opens /crm and nothing else. If
    // this ever flips true, a telecaller gets the question bank and the report
    // triage with it.
    expect(selectIsCrmStaff(stateWithRole('telecaller'))).toBe(true)
    expect(selectIsAdmin(stateWithRole('telecaller'))).toBe(false)
  })

  it('lets admins and superadmins supervise the desk', () => {
    expect(selectIsCrmStaff(stateWithRole('admin'))).toBe(true)
    expect(selectIsCrmStaff(stateWithRole('superadmin'))).toBe(true)
    expect(selectIsCrmStaff(stateWithRole('user'))).toBe(false)
  })

  it('identifies a telecaller exactly', () => {
    expect(selectIsTelecaller(stateWithRole('telecaller'))).toBe(true)
    expect(selectIsTelecaller(stateWithRole('admin'))).toBe(false)
  })

  it('skips the student onboarding gate', () => {
    // A staff account has no phone on its profile and must not be trapped on
    // /complete-profile forever.
    expect(selectProfileNeedsOnboarding(stateWithRole('telecaller'))).toBe(false)
    expect(selectProfileNeedsOnboarding(stateWithRole('user'))).toBe(true)
  })
})

describe('phone normalisation', () => {
  it('accepts every shape an Indian mobile is written in', () => {
    for (const raw of ['9876543210', '+919876543210', '919876543210', '09876543210', '98765 43210']) {
      expect(tenDigit(raw)).toBe('9876543210')
    }
  })

  it('rejects junk and landline-shaped numbers', () => {
    // Leading digit must be 6-9 — the dedupe index keys on this, so a bad
    // number has to become null rather than collide.
    expect(tenDigit('1234567890')).toBe('')
    expect(tenDigit('98765')).toBe('')
    expect(tenDigit(null)).toBe('')
  })
})

describe('click-to-action links', () => {
  it('builds a dialer link with the country code', () => {
    expect(telLink('9876543210')).toBe('tel:+919876543210')
    expect(telLink('nope')).toBeNull()
  })

  it('builds a wa.me link with a pre-filled opener', () => {
    const url = whatsappLink('9876543210', 'Hi Kavitha')
    expect(url).toBe('https://wa.me/919876543210?text=Hi%20Kavitha')
  })

  it('only offers mailto for a plausible address', () => {
    expect(mailLink('a@b.co')).toBe('mailto:a@b.co')
    expect(mailLink('not-an-email')).toBeNull()
  })
})

describe('response timer', () => {
  /** An inbound signup — the only kind the response promise applies to. */
  const at = (entered: string, extra: Partial<Lead> = {}): Lead =>
    ({
      source: 'signup',
      created_at: entered,
      entered_at: entered,
      first_response_at: null,
      first_response_secs: null,
      ...extra,
    }) as Lead

  const T0 = Date.parse('2026-09-07T10:00:00Z')

  it('escalates as an inbound lead waits', () => {
    expect(slaState(at('2026-09-07T10:00:00Z'), T0).level).toBe('fresh')
    expect(slaState(at('2026-09-07T10:00:00Z'), T0 + (SLA_TARGET_SECS + 1) * 1000).level).toBe('warn')
    expect(slaState(at('2026-09-07T10:00:00Z'), T0 + (SLA_WARN_SECS + 1) * 1000).level).toBe('late')
    expect(slaState(at('2026-09-07T10:00:00Z'), T0 + (SLA_BREACH_SECS + 1) * 1000).level).toBe(
      'breached'
    )
  })

  it('never escalates a backfilled or imported lead', () => {
    // The regression this guards: 682 backfilled rows all rendered as
    // months-overdue breaches, which drained the colour of meaning for the
    // handful of inbound leads that genuinely were late.
    for (const source of ['backfill', 'import', 'manual'] as const) {
      const old = at('2026-09-07T10:00:00Z', { source })
      expect(slaState(old, T0 + 40 * 24 * 3600_000).level).toBe('backlog')
    }
  })

  it('times from when the lead reached the desk, not when the person signed up', () => {
    // A backfilled account signed up in June but landed on the desk today; the
    // team cannot be late answering something that was not in front of them.
    const lead = at('2026-09-07T10:00:00Z', {
      source: 'signup',
      created_at: '2026-06-01T00:00:00Z',
      entered_at: '2026-09-07T09:58:00Z',
    })
    expect(slaState(lead, T0).seconds).toBe(120)
  })

  it('freezes once the lead has been contacted', () => {
    // The clock must stop at the recorded value, not keep running off `now`.
    const contacted = at('2026-09-07T10:00:00Z', {
      first_response_at: '2026-09-07T10:02:00Z',
      first_response_secs: 120,
    })
    const state = slaState(contacted, T0 + 5 * 3600_000)
    expect(state.running).toBe(false)
    expect(state.level).toBe('done')
    expect(state.seconds).toBe(120)
  })

  it('formats a duration for a narrow chip', () => {
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3 * 3600 + 25 * 60)).toBe('3h 25m')
    expect(formatDuration(2 * 86_400)).toBe('2d')
  })
})

describe('cold-list CSV import', () => {
  it('reads a headered file and skips rows with no usable number', () => {
    const { rows, skipped } = parseLeadCsv(
      ['name,mobile,email', 'Kavitha R,9876543210,k@example.com', 'Broken,123,x@example.com'].join(
        '\n'
      )
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Kavitha R', phone: '9876543210' })
    expect(skipped).toBe(1)
  })

  it('honours quoted fields containing a comma', () => {
    const { rows } = parseLeadCsv('name,phone\n"Raj, S",9876543210')
    expect(rows[0].name).toBe('Raj, S')
  })

  it('falls back to positional reading when there is no header', () => {
    // Bought lists routinely arrive with no header row at all.
    const { rows } = parseLeadCsv('Kavitha R,9876543210,k@example.com')
    expect(rows).toHaveLength(1)
    expect(rows[0].phone).toBe('9876543210')
    expect(rows[0].email).toBe('k@example.com')
  })
})
