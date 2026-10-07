// The signup gate rests on this module's verdicts, so the contract that matters
// most is the one that is invisible in production: 'unknown' on EVERY failure
// shape. The route fails open on 'unknown', so a bug that turned a gateway
// error into a confident 'no' would silently block every signup — the exact
// failure this project already lived through once with the HIBP check.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// config.ts reads process.env at module-eval time, so the gateway must look
// configured BEFORE whatsappCheck (and the config it imports) is first loaded.
process.env.EVOLUTION_BASE_URL = 'https://gateway.test'
// The INSTANCE token, not the host's global admin key — Evolution GO routes
// /user/check by which token is sent, and rejects the global one.
process.env.EVOLUTION_API_KEY = 'test-instance-token'
process.env.EVOLUTION_INSTANCE = 'test-instance'

const { isOnWhatsApp } = await import('./whatsappCheck.js')

/** A fresh 10-digit number per test — the module caches by number, and a
 * leaked cache entry would make a later test pass for the wrong reason. */
let seq = 0
const freshPhone = () => `9${String(800000000 + seq++).padStart(9, '0')}`

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // Silence the module's deliberate console.error diagnostics; they are
  // asserted behaviour-wise, not text-wise.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Shape a fetch Response closely enough for the module's use of it. */
function reply(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response
}

/** Evolution GO's real 200 body, as captured from the live gateway. The
 * capitalised keys come from its Go struct tags — a lowercase `isInWhatsapp`
 * would be a different (wrong) field and must read as no answer. */
function users(inWhatsapp: boolean, phone = '919876543210') {
  return {
    data: {
      Users: [
        {
          Query: `+${phone}@s.whatsapp.net`,
          IsInWhatsapp: inWhatsapp,
          JID: `${phone}@s.whatsapp.net`,
          RemoteJID: `${phone}@s.whatsapp.net`,
          LID: inWhatsapp ? '128536006377563@lid' : null,
          VerifiedName: '',
        },
      ],
    },
    message: 'success',
  }
}

describe('isOnWhatsApp — the answer', () => {
  it("says 'yes' when the gateway reports the account exists", async () => {
    const phone = freshPhone()
    fetchMock.mockResolvedValue(reply(200, users(true, `91${phone}`)))
    await expect(isOnWhatsApp(phone)).resolves.toBe('yes')
  })

  it("says 'no' when the gateway reports no account — the one hard block", async () => {
    const phone = freshPhone()
    fetchMock.mockResolvedValue(reply(200, users(false, `91${phone}`)))
    await expect(isOnWhatsApp(phone)).resolves.toBe('no')
  })
})

describe('isOnWhatsApp — every failure is "unknown", never "no"', () => {
  it("on 401 (wrong token, or the host's global key, which this route rejects)", async () => {
    fetchMock.mockResolvedValue(reply(401, { error: 'not authorized' }))
    await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
  })

  it('on 404 (wrong base URL — Evolution GO answers plain "404 page not found")', async () => {
    fetchMock.mockResolvedValue(reply(404, null))
    await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
  })

  it('on 500 (instance logged out / QR expired)', async () => {
    fetchMock.mockResolvedValue(reply(500, { error: 'Connection Closed' }))
    await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
  })

  it('when the connection throws or the 10s timeout fires', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'))
    await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
  })

  it('when the response is 200 but not the shape we expect', async () => {
    // A gateway upgrade changing this shape must not be read as a verdict.
    const shapes: unknown[] = [
      null,
      {},
      { data: null },
      { data: {} },
      { data: { Users: [] } },
      { data: { Users: [{}] } },
      // v2 Evolution API's shape — a wrong gateway must not be read as a verdict.
      [{ exists: true }],
      // Right field, wrong type / casing.
      { data: { Users: [{ IsInWhatsapp: 'true' }] } },
      { data: { Users: [{ IsInWhatsapp: null }] } },
      { data: { Users: [{ isInWhatsapp: true }] } },
    ]
    for (const body of shapes) {
      fetchMock.mockResolvedValue(reply(200, body))
      await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
    }
  })

  it('when the body is not JSON at all (an HTML error page from a proxy)', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON')
      },
    } as unknown as Response)
    await expect(isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
  })
})

describe('isOnWhatsApp — the request it makes', () => {
  it('asks about the 91-prefixed number, on the configured instance, with the key', async () => {
    const phone = freshPhone()
    fetchMock.mockResolvedValue(reply(200, users(true, `91${phone}`)))
    await isOnWhatsApp(phone)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // No instance in the path — Evolution GO routes by the token alone.
    expect(url).toBe('https://gateway.test/user/check')
    expect(init.method).toBe('POST')
    // The token travels in the `apikey` header, not Authorization.
    expect((init.headers as Record<string, string>).apikey).toBe('test-instance-token')
    // Singular `number`, and an ARRAY; country code prefixed, since the gateway
    // would not match a bare 10-digit number.
    expect(JSON.parse(String(init.body))).toEqual({ number: [`91${phone}`] })
  })
})

describe('isOnWhatsApp — caching', () => {
  it('answers a repeat lookup from cache, sparing the gateway a call', async () => {
    // This is what keeps a resubmitted signup form (duplicate email, weak
    // password) from spending a second gateway call on the same number —
    // repeated lookups are what gets a Baileys-paired number flagged.
    const phone = freshPhone()
    fetchMock.mockResolvedValue(reply(200, users(true, `91${phone}`)))
    await expect(isOnWhatsApp(phone)).resolves.toBe('yes')
    await expect(isOnWhatsApp(phone)).resolves.toBe('yes')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT cache an "unknown" — a dropped session must be retried', async () => {
    const phone = freshPhone()
    fetchMock.mockResolvedValueOnce(reply(500, { error: 'Connection Closed' }))
    await expect(isOnWhatsApp(phone)).resolves.toBe('unknown')
    fetchMock.mockResolvedValueOnce(reply(200, users(true, `91${phone}`)))
    await expect(isOnWhatsApp(phone)).resolves.toBe('yes')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('isOnWhatsApp — not configured', () => {
  it("returns 'unknown' without touching the network", async () => {
    // Mirrors a fresh environment with no EVOLUTION_API_KEY: the route checks
    // whatsappCheckEnabled and 503s before here, but the lib must not pretend
    // to have an answer either way.
    vi.resetModules()
    const saved = process.env.EVOLUTION_API_KEY
    delete process.env.EVOLUTION_API_KEY
    try {
      const fresh = await import('./whatsappCheck.js')
      await expect(fresh.isOnWhatsApp(freshPhone())).resolves.toBe('unknown')
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      process.env.EVOLUTION_API_KEY = saved
    }
  })
})
