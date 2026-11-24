import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const platform = vi.hoisted(() => ({ IS_WEB: true }))
vi.mock('../lib/platform', () => platform)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (el: any, props: object, ...kids: unknown[]) =>
  renderToStaticMarkup(h(MemoryRouter, null, h(el as never, props as never, ...(kids as never[]))))
/** Class lists with every `web:` token removed — what the installed app sees. */
const nativeClasses = (html: string) =>
  [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/).filter((c) => c && !c.startsWith('web:')).join(' '))

describe('web-page-kit', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('AC1/AC4 PageGrid: web gets the 6xl shell + sidebar grid; native keeps its width and drops the aside', async () => {
    platform.IS_WEB = true
    let { PageGrid } = await import('../components/Site/PageKit')
    let html = render(PageGrid, { aside: h('p', null, 'SIDE') }, 'MAIN')
    expect(html).toContain('web:max-w-6xl')
    expect(html).toContain('lg:grid-cols-[minmax(0,1fr)_300px]')
    expect(html).toContain('<aside')

    vi.resetModules()
    platform.IS_WEB = false
    ;({ PageGrid } = await import('../components/Site/PageKit'))
    html = render(PageGrid, { aside: h('p', null, 'SIDE') }, 'MAIN')
    expect(html).not.toContain('SIDE')
    expect(html).not.toContain('lg:grid')
    expect(nativeClasses(html)[0]).toBe('mx-auto w-full px-4 max-w-2xl')
  })

  it('AC1 PageGrid without an aside stays one column (no empty sidebar gutter)', async () => {
    platform.IS_WEB = true
    const { PageGrid } = await import('../components/Site/PageKit')
    expect(render(PageGrid, {}, 'MAIN')).not.toContain('lg:grid')
  })

  it('AC3 Crumbs: breadcrumb nav with links + aria-current on the last; nothing on native', async () => {
    platform.IS_WEB = true
    let { Crumbs } = await import('../components/Site/PageKit')
    const items = [{ label: 'Home', to: '/test-arena' }, { label: 'PYQ' }]
    const html = render(Crumbs, { items })
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('href="/test-arena"')
    expect(html).toMatch(/aria-current="page"[^>]*>PYQ</)

    vi.resetModules()
    platform.IS_WEB = false
    ;({ Crumbs } = await import('../components/Site/PageKit'))
    expect(render(Crumbs, { items })).toBe('')
  })

  it('AC1 SectionBlock is a card only via web: classes (plain section natively)', async () => {
    const { SectionBlock } = await import('../components/Site/PageKit')
    const html = render(SectionBlock, { title: 'T' }, 'body')
    expect(html).toContain('web:rounded-card')
    expect(nativeClasses(html)[0]).toBe('scroll-mt-24')
  })

  it('AC2 shared primitives: native classes unchanged once web: tokens are stripped', async () => {
    const { List, ListRow } = await import('../components/UI/ListRow')
    const SectionHeader = (await import('../components/UI/SectionHeader')).default
    const { ChoiceGrid } = await import('../components/UI/ChoiceCard')
    expect(nativeClasses(render(List, {}, 'x'))[0]).toBe('divide-y divide-line')
    expect(nativeClasses(render(ListRow, { title: 'A' }))[0]).toBe(
      'focus-ring group flex w-full items-center gap-3 py-3 text-left disabled:opacity-45'
    )
    expect(nativeClasses(render(SectionHeader, { title: 'S' }))[1]).toBe(
      'tamil font-display text-base font-semibold tracking-tight text-ink'
    )
    expect(nativeClasses(render(ChoiceGrid, {}, 'x'))[0]).toBe('grid grid-cols-2 gap-3')
  })
})
