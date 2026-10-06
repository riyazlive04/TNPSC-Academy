import { describe, expect, it } from 'vitest'
import { shownHubTab, type TestSeriesFlags } from '../lib/testSeriesFlags'

// Which /test-series tab is on screen. The failure this pins is silent: a
// learner sent to the Group II/IIA tab (the /group-2-test-series link) quietly
// shown the Group 1 series because the flags had not finished loading.

const bothOn: TestSeriesFlags = { marathon: true, rankBooster: true, targetG2: false }
const notLoaded: TestSeriesFlags = { marathon: false, rankBooster: false, targetG2: false }
const onlyG1: TestSeriesFlags = { marathon: true, rankBooster: false, targetG2: false }
const onlyG2: TestSeriesFlags = { marathon: false, rankBooster: true, targetG2: false }
const onlyTargetG2: TestSeriesFlags = { marathon: false, rankBooster: false, targetG2: true }
const allOn: TestSeriesFlags = { marathon: true, rankBooster: true, targetG2: true }

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
    expect(shownHubTab('overall', onlyTargetG2)).toBe('overall')
  })

  it('shows the Target Group 2 tab that was asked for', () => {
    expect(shownHubTab('targetg2', allOn)).toBe('targetg2')
    expect(shownHubTab('targetg2', onlyTargetG2)).toBe('targetg2')
  })

  it('keeps the Target Group 2 tab while the flags are still loading', () => {
    expect(shownHubTab('targetg2', notLoaded)).toBe('targetg2')
  })

  it('falls back off a switched-off Target Group 2 in the hub tab order', () => {
    expect(shownHubTab('targetg2', bothOn)).toBe('vettri')
    expect(shownHubTab('targetg2', onlyG2)).toBe('rankbooster')
  })

  it('falls back TO Target Group 2 when it is the only product on', () => {
    expect(shownHubTab('vettri', onlyTargetG2)).toBe('targetg2')
    expect(shownHubTab('rankbooster', onlyTargetG2)).toBe('targetg2')
  })
})
