import { describe, expect, test } from 'claude-code/testing'

import {
  effortFromSettings,
  formatLimit,
  formatModel,
  formatStatus,
  formatTimeLeft,
  formatTokens,
} from './format'

const NOW = Date.parse('2026-10-10T12:00:00Z')

describe('formatTokens', () => {
  test('keeps small counts as they are', async () => {
    expect(formatTokens(950)).toBe('950')
  })
  test('shortens thousands and millions', async () => {
    expect(formatTokens(45_200)).toBe('45.2k')
    expect(formatTokens(1_234_567)).toBe('1.2M')
  })
})

describe('formatModel', () => {
  test('turns an API id into a display name', async () => {
    expect(formatModel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(formatModel('claude-sonnet-5-5-20260101')).toBe('Sonnet 5.5')
  })
  test('keeps any other name', async () => {
    expect(formatModel('Opus 5.5')).toBe('Opus 5.5')
  })
})

describe('formatTimeLeft', () => {
  test('shows minutes, hours, and days', async () => {
    expect(formatTimeLeft('2026-10-10T12:45:00Z', NOW)).toBe('45m')
    expect(formatTimeLeft('2026-10-10T15:10:00Z', NOW)).toBe('3h 10m')
    expect(formatTimeLeft('2026-10-12T16:00:00Z', NOW)).toBe('2d 4h')
  })
  test('never goes below zero', async () => {
    expect(formatTimeLeft('2026-10-10T11:00:00Z', NOW)).toBe('0m')
  })
  test('gives up on a bad timestamp', async () => {
    expect(formatTimeLeft('soon', NOW)).toBeUndefined()
  })
})

describe('formatLimit', () => {
  test('shows the percentage and the time to reset', async () => {
    const window = { kind: 'five_hour', percentUsed: 12.4, resetsAt: '2026-10-10T15:10:00Z' }
    expect(formatLimit('5h', window, NOW)).toBe('5h 12% (3h 10m)')
  })
  test('shows a dash before the first reading', async () => {
    expect(formatLimit('week', undefined, NOW)).toBe('week --')
  })
})

describe('formatStatus', () => {
  const base = {
    model: 'claude-opus-5-5',
    contextTokens: 45_200,
    contextWindow: 200_000,
    contextPercent: 23,
    tokensIn: 1_234_567,
    tokensOut: 34_500,
    costUsd: 1.234,
    now: NOW,
  }

  test('builds the full line with both usage limits', async () => {
    const line = formatStatus({
      ...base,
      limits: [
        { kind: 'five_hour', percentUsed: 12, resetsAt: '2026-10-10T15:10:00Z' },
        { kind: 'seven_day', percentUsed: 34, resetsAt: '2026-10-12T16:00:00Z' },
      ],
    })
    expect(line).toBe(
      '[Opus 5.5 · --] ctx 45.2k/200.0k (23%) | in 1.2M out 34.5k | $1.23 | 5h 12% (3h 10m) | week 34% (2d 4h)',
    )
  })

  test('leaves out the limits off a subscription, and dashes an unknown context', async () => {
    const line = formatStatus({
      ...base,
      contextTokens: undefined,
      contextPercent: undefined,
      costUsd: undefined,
      limits: [],
    })
    expect(line).toBe('[Opus 5.5 · --] ctx --/200.0k | in 1.2M out 34.5k')
  })

  test('shows the effort next to the model', async () => {
    const line = formatStatus({ ...base, effort: 'medium', limits: [] })
    expect(line.startsWith('[Opus 5.5 · medium] ctx')).toBe(true)
  })

  test('shows a dash when the effort is unknown', async () => {
    const line = formatStatus({ ...base, limits: [] })
    expect(line).toContain('[Opus 5.5 · --]')
  })
  test('shows a numeric effort as a number', async () => {
    const line = formatStatus({ ...base, effort: 32000, limits: [] })
    expect(line.startsWith('[Opus 5.5 · 32000] ctx')).toBe(true)
  })

  test('dashes a window the engine has not reported yet', async () => {
    const line = formatStatus({ ...base, limits: [{ kind: 'five_hour', percentUsed: 5 }] })
    expect(line.endsWith('| 5h 5% | week --')).toBe(true)
  })
})

describe('effortFromSettings', () => {
  test('reads the per-model setting first', async () => {
    const settings = { effortLevel: 'low', modelSettings: { 'claude-opus-5-5': { effortLevel: 'medium' } } }
    expect(effortFromSettings(settings, 'claude-opus-5-5')).toBe('medium')
  })
  test('falls back to the global setting', async () => {
    expect(effortFromSettings({ effortLevel: 'high' }, 'claude-opus-5-5')).toBe('high')
  })
  test('gives nothing when no setting exists', async () => {
    expect(effortFromSettings({}, null)).toBeUndefined()
    expect(effortFromSettings(undefined, null)).toBeUndefined()
  })
})
