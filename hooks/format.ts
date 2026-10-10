/**
 * Pure formatting for the usage-status line. Nothing here touches the engine,
 * so every function can be tested with plain values.
 */

/**
 * One rate-limit window as `$.session.usage()` reports it.
 */
export interface LimitWindow {
  /** `five_hour`, `seven_day`, or a gateway's `spend_limit`. */
  kind: string
  /** Share of the window used, 0 to 100. */
  percentUsed: number
  /** When the window resets, as an ISO 8601 timestamp. */
  resetsAt?: string
}

/**
 * Everything the status line shows, gathered from the engine.
 */
export interface StatusFigures {
  /** The model's display name or API id, or null when unknown. */
  model: string | null
  /** The reasoning effort, as a level such as `medium` or a token budget. */
  effort?: string | number
  /** Input tokens of the last response, or undefined before the first one. */
  contextTokens?: number
  /** The model's context window in tokens. */
  contextWindow: number
  /** Context fill as a whole percentage, when known. */
  contextPercent?: number
  /** Input tokens summed over the session's turns. */
  tokensIn: number
  /** Output tokens summed over the session's turns. */
  tokensOut: number
  /** The session's cost in US dollars, when the host keeps a ledger. */
  costUsd?: number
  /** The account's rate-limit windows; empty off a subscription. */
  limits: LimitWindow[]
  /** The current time in milliseconds since the epoch. */
  now: number
}

/**
 * Formats a token count as 950, 12.3k, or 1.2M.
 *
 * @param n the token count
 * @returns the short form
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/**
 * Turns an API model id such as `claude-opus-5-5` into `Opus 5.5`. Any other
 * name is returned as it is.
 *
 * @param model the model name or id
 * @returns the display name
 */
export function formatModel(model: string): string {
  const match = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(model)
  if (!match) return model
  const [, family = '', major, minor] = match
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}`
}

/**
 * Formats the time until a reset as `45m`, `3h 10m`, or `2d 4h`.
 *
 * @param resetsAt the reset time as an ISO 8601 timestamp
 * @param now the current time in milliseconds since the epoch
 * @returns the time left, or undefined when the timestamp cannot be read
 */
export function formatTimeLeft(resetsAt: string, now: number): string | undefined {
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return undefined
  const minutes = Math.max(0, Math.round((at - now) / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/**
 * Formats one rate-limit window as `5h 12% (3h 10m)`.
 *
 * @param label the short name shown for the window
 * @param window the window, or undefined when the engine has no reading yet
 * @param now the current time in milliseconds since the epoch
 * @returns the formatted part
 */
export function formatLimit(label: string, window: LimitWindow | undefined, now: number): string {
  if (!window) return `${label} --`
  const percent = `${Math.round(window.percentUsed)}%`
  const left = window.resetsAt ? formatTimeLeft(window.resetsAt, now) : undefined
  return left ? `${label} ${percent} (${left})` : `${label} ${percent}`
}

/**
 * Builds the full status line, for example:
 * `[Opus 5.5] ctx 45.2k/200.0k (23%) | in 1.2M out 34.5k | $1.23 | 5h 12% (3h 10m) | week 34% (2d 4h)`.
 *
 * @param f the figures to show
 * @returns the status line text
 */
export function formatStatus(f: StatusFigures): string {
  const parts: string[] = []

  let model = f.model ? formatModel(f.model) : 'unknown'
  if (f.effort !== undefined) model += ` · ${f.effort}`
  const used = f.contextTokens === undefined ? '--' : formatTokens(f.contextTokens)
  let ctx = `ctx ${used}/${formatTokens(f.contextWindow)}`
  if (f.contextPercent !== undefined) ctx += ` (${Math.round(f.contextPercent)}%)`
  parts.push(`[${model}] ${ctx}`)

  parts.push(`in ${formatTokens(f.tokensIn)} out ${formatTokens(f.tokensOut)}`)

  if (f.costUsd !== undefined) parts.push(`$${f.costUsd.toFixed(2)}`)

  const session = f.limits.find(l => l.kind === 'five_hour')
  const weekly = f.limits.find(l => l.kind === 'seven_day')
  if (f.limits.length > 0) {
    parts.push(formatLimit('5h', session, f.now))
    parts.push(formatLimit('week', weekly, f.now))
  }

  return parts.join(' | ')
}

/**
 * Reads the effort level from Claude Code settings: the per-model
 * `modelSettings[model].effortLevel` first, then the global `effortLevel`.
 *
 * @param settings the merged settings object, as `$.settings.read()` gives it
 * @param modelId the model's API id, or null when unknown
 * @returns the effort level, or undefined when no setting exists
 */
export function effortFromSettings(settings: unknown, modelId: string | null): string | undefined {
  if (typeof settings !== 'object' || settings === null) return undefined
  const s = settings as {
    effortLevel?: unknown
    modelSettings?: Record<string, { effortLevel?: unknown } | undefined>
  }
  const perModel = modelId ? s.modelSettings?.[modelId]?.effortLevel : undefined
  if (typeof perModel === 'string') return perModel
  return typeof s.effortLevel === 'string' ? s.effortLevel : undefined
}
