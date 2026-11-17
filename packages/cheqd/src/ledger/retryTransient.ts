/**
 * Error codes that indicate a transient transport problem (RPC not yet reachable, connection reset,
 * DNS blip) rather than a real answer from the chain.
 */
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

export interface RetryTransientOptions {
  /** Total attempts including the first one. Defaults to 3 */
  attempts?: number
  /** Delay before the first retry in ms; doubles on every further retry. Defaults to 250 */
  baseDelayMs?: number
  /** Called before each retry, useful for logging */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

/**
 * True for errors that come from the network layer (undici / CosmJS HTTP client `fetch failed`, resets,
 * timeouts). Errors returned by the chain itself (not found, invalid request, ...) are NOT transient.
 */
export function isTransientTransportError(error: unknown): boolean {
  let current: unknown = error
  // The useful code is usually on `cause`, sometimes a few levels deep
  for (let depth = 0; depth < 5 && current; depth++) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (typeof candidate.code === 'string' && TRANSIENT_ERROR_CODES.has(candidate.code)) return true
    if (typeof candidate.message === 'string' && candidate.message.includes('fetch failed')) return true
    current = candidate.cause
  }
  return false
}

/**
 * Runs `operation`, retrying a small, bounded number of times only when it fails with a transient transport error.
 * Real failures are thrown straight away. Use for idempotent reads only, never for transactions.
 */
export async function retryOnTransientError<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 250, onRetry }: RetryTransientOptions = {}
): Promise<T> {
  let attempt = 1
  while (true) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= attempts || !isTransientTransportError(error)) throw error
      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      onRetry?.(error, attempt, delayMs)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempt++
    }
  }
}
