import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { UsageStatusTotals } from '../types'
import { effortFromSettings, formatStatus } from './format'

const ZERO: UsageStatusTotals = { tokensIn: 0, tokensOut: 0 }

const totals = atom({ plugin: 'usage-status', key: 'totals' } as const, ZERO)
const lastModel = atom({ plugin: 'usage-status', key: 'model' } as const, null)
const lastEffort = atom({ plugin: 'usage-status', key: 'effort' } as const, null)

/**
 * Reads the engine's figures and pins the status line.
 *
 * @param $ the engine interface
 */
async function refresh($: EngineInterface): Promise<void> {
  const [usage, sum, turnModel, turnEffort, now] = await Promise.all([
    $.session.usage(),
    read($, totals),
    read($, lastModel),
    read($, lastEffort),
    $.clock.now(),
  ])
  const model = turnModel ?? (await $.session.model())
  // Before the first request, fall back to the effort in settings.
  const effort = turnEffort ?? effortFromSettings(await $.settings.read(), model)

  $.ui.status(
    formatStatus({
      model,
      effort,
      contextTokens: usage.context.tokens,
      contextWindow: usage.context.window,
      contextPercent: usage.context.percent,
      tokensIn: sum.tokensIn,
      tokensOut: sum.tokensOut,
      costUsd: usage.cost?.usd,
      limits: usage.rateLimits,
      now,
    }),
  )
}

/**
 * The usage-status mod: a status line with the model, the context fill, the
 * session's tokens and cost, and the 5-hour and weekly usage limits.
 */
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    // Keeps the reset countdowns current while the session is idle.
    $.clock.every(60_000, () => refresh($))
    return result
  })

  // Records the effort each main-thread request is sent with.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) await update($, lastEffort, () => e.effort ?? null)
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const usage = e.usage
    if (usage) {
      await update($, totals, t => ({
        tokensIn:
          t.tokensIn +
          usage.input_tokens +
          usage.cache_read_input_tokens +
          usage.cache_creation_input_tokens,
        tokensOut: t.tokensOut + usage.output_tokens,
      }))
      if (e.agentId === undefined) await update($, lastModel, () => usage.model)
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, totals, () => ZERO)
      await refresh($)
    }
    return next(e)
  })
}
