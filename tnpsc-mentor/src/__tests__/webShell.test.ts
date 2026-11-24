import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnswerKeyFooter } from '../components/Landing/AnswerKeyChrome'

const native = vi.hoisted(() => ({ value: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))

describe('web-shell', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as { window?: unknown }).window = { location: { search: '' } }
  })

  it('AC1/AC2 IS_WEB is true in a browser and false in the packaged app', async () => {
    native.value = false
    expect((await import('../lib/platform')).IS_WEB).toBe(true)
    vi.resetModules()
    native.value = true
    expect((await import('../lib/platform')).IS_WEB).toBe(false)
  })

  it('AC2 dev ?native override forces the app look in a browser', async () => {
    native.value = false
    ;(globalThis as { window?: unknown }).window = { location: { search: '?native' } }
    expect((await import('../lib/platform')).IS_WEB).toBe(false)
  })

  const base = { tagline: 'T', followLabel: 'F', disclaimer: 'D' }

  it('AC1 footer renders the site link row when links are given', () => {
    const html = renderToStaticMarkup(
      createElement(AnswerKeyFooter, { ...base, links: [{ href: 'https://tnpscmentors.in/', label: 'All questions' }] })
    )
    expect(html).toContain('aria-label="Site"')
    expect(html).toContain('href="https://tnpscmentors.in/"')
  })

  it('AC6 answer-key footer (no links) is unchanged', () => {
    const html = renderToStaticMarkup(createElement(AnswerKeyFooter, base))
    expect(html).not.toContain('aria-label="Site"')
    expect(html).toContain('border-t border-line pt-6')
  })
})
