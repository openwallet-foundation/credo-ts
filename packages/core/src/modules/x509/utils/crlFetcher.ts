import type { AgentContext } from '../../../agent'
import { TypedArrayEncoder } from '../../../utils'
import { fetchWithTimeout } from '../../../utils/fetch'
import { CacheModuleConfig } from '../../cache'
import { X509Error } from '../X509Error'

export interface CrlFetchOptions {
  url: string
  agentContext: AgentContext

  /**
   * Maximum CRL fetch time after which request will be aborted
   * @default 5000 (5 seconds)
   */
  timeoutMs?: number

  /**
   * Maximum size in bytes for CRL downloads
   * @default 10485760 (10 MB)
   */
  maxSizeBytes?: number
}

/**
 * Default maximum CRL size in bytes (10 MB)
 * This is a reasonable limit as most CRLs are much smaller.
 * Very large CRLs (>10 MB) are uncommon and may indicate issues.
 */
const DEFAULT_MAX_CRL_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Default cache expiry time in milliseconds (5 seconds)
 */
const DEFAULT_TIMEOUT_MILLISECONDS = 5000

function crlCacheKey(url: string): string {
  return `x509:crl:${url}`
}

/**
 * Fetches a CRL from a given URL with size limit and timeout enforcement.
 *
 * This does NOT cache: caching is the responsibility of the caller, which should only cache a CRL
 * after it has been verified (see {@link setCachedCrl}), so unverified or expired CRLs are never
 * persisted.
 *
 * @throws {X509Error} If the fetch fails, returns a non-OK status, or exceeds the size limit
 */
export async function fetchCrl(options: CrlFetchOptions): Promise<Uint8Array> {
  const {
    url,
    timeoutMs = DEFAULT_TIMEOUT_MILLISECONDS,
    agentContext,
    maxSizeBytes = DEFAULT_MAX_CRL_SIZE_BYTES,
  } = options

  try {
    const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, url, {
      timeoutMs,
      maxResponseBytes: maxSizeBytes,
    })

    if (!response.ok) {
      throw new X509Error(`Failed to fetch CRL from ${url}: HTTP ${response.status} ${response.statusText}`)
    }

    return new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    if (error instanceof X509Error) {
      throw error
    }
    throw new X509Error(`Failed to fetch CRL from ${url}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error instanceof Error ? error : undefined,
    })
  }
}

/**
 * Return the cached (and previously verified) CRL bytes for a URL, or `null` if not cached.
 */
export async function getCachedCrl(agentContext: AgentContext, url: string): Promise<Uint8Array | null> {
  const cache = agentContext.resolve(CacheModuleConfig).cache
  const cached = await cache.get<string>(agentContext, crlCacheKey(url)).catch(() => null)
  return cached ? TypedArrayEncoder.fromBase64(cached) : null
}

/**
 * Cache verified CRL bytes for a URL.
 *
 * Callers must only cache CRLs that have passed verification (signature, issuer, validity window),
 * and should derive `expiresInSeconds` from the CRL's `nextUpdate` so an expired CRL is never
 * served from the cache.
 */
export async function setCachedCrl(
  agentContext: AgentContext,
  url: string,
  data: Uint8Array,
  expiresInSeconds: number
): Promise<void> {
  if (expiresInSeconds <= 0) return
  const cache = agentContext.resolve(CacheModuleConfig).cache
  await cache.set(agentContext, crlCacheKey(url), TypedArrayEncoder.toBase64(data), expiresInSeconds).catch(() => null)
}
