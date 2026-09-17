import { describe, expect, it } from 'vitest'
import { shownHubTab, type TestSeriesFlags } from '../lib/testSeriesFlags'

// Which /test-series tab is on screen. The failure this pins is silent: a
// learner sent to the Group II/IIA tab (the /group-2-test-series link) quietly
// shown the Group 1 series because the flags had not finished loading.

const bothOn: TestSeriesFlags = { marathon: true, rankBooster: true }
const notLoaded: TestSeriesFlags = { marathon: false, rankBooster: false }
const onlyG1: TestSeriesFlags = { marathon: true, rankBooster: false }
const onlyG2: TestSeriesFlags = { marathon: false, rankBooster: true }

describe('shownHubTab', () => {
  it('shows the Group II/IIA tab that was asked for', () => {
    expect(shownHubTab('rankbooster', bothOn)).toBe('rankbooster')
  })

  it('keeps the requested tab while the flags are still loading', () => {
    expect(shownHubTab('rankbooster', notLoaded)).toBe('rankbooster')
    expect(shownHubTab('vettri', notLoaded)).toBe('vettri')
  })

  it('returns to the requested tab once loading finishes, so no fallback sticks', () => {
    // Derived per render: whatever an intermediate answer said, the final
    // flags alone decide the tab.
    expect(shownHubTab('rankbooster', onlyG1)).toBe('vettri')
    expect(shownHubTab('rankbooster', bothOn)).toBe('rankbooster')
  })

  it('falls back to the other product when the requested one is switched off', () => {
    expect(shownHubTab('rankbooster', onlyG1)).toBe('vettri')
    expect(shownHubTab('vettri', onlyG2)).toBe('rankbooster')
  })

  it('never moves the combined analytics tab', () => {
    expect(shownHubTab('overall', onlyG1)).toBe('overall')
    expect(shownHubTab('overall', onlyG2)).toBe('overall')
  })
})
