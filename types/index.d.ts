/**
 * Token totals this mod adds up over the session's turns.
 */
export type UsageStatusTotals = {
  /** Input tokens, cached and uncached together, summed over every turn. */
  tokensIn: number
  /** Output tokens summed over every turn. */
  tokensOut: number
}

declare module 'claude-code' {
  /**
   * The values this mod keeps in `$.state`, so they survive a reload.
   */
  interface PluginState {
    'usage-status': {
      totals: UsageStatusTotals
      model: string | null
      effort: string | number | null
    }
  }
}
