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

  /**
   * Cache expiry time in seconds
   * @default 3600 (1 hour)
   */
  cacheExpirySeconds?: number
}

/**
 * Default maximum CRL size in bytes (10 MB)
 * This is a reasonable limit as most CRLs are much smaller.
 * Very large CRLs (>10 MB) are uncommon and may indicate issues.
 */
const DEFAULT_MAX_CRL_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Default cache expiry time in seconds (1 hour)
 */
const DEFAULT_CACHE_EXPIRY_SECONDS = 3600

/**
 * Default cache expiry time in milliseconds (5 seconds)
 */
const DEFAULT_TIMEOUT_MILLISECONDS = 5000

/**
 * Fetches a CRL from a given URL with size limit enforcement and optional caching
 * @throws {X509Error} If the fetch fails, returns a non-OK status, or exceeds size limit
 */
export async function fetchCrl(options: CrlFetchOptions): Promise<Uint8Array> {
  const {
    url,
    timeoutMs = DEFAULT_TIMEOUT_MILLISECONDS,
    agentContext,
    maxSizeBytes = DEFAULT_MAX_CRL_SIZE_BYTES,
    cacheExpirySeconds = DEFAULT_CACHE_EXPIRY_SECONDS,
  } = options

  const cache = agentContext.resolve(CacheModuleConfig).cache

  // Check cache first if available
  const cacheKey = `x509:crl:${url}`
  const cachedData = await cache.get<string>(agentContext, cacheKey).catch(() => null)
  if (cachedData) {
    return TypedArrayEncoder.fromBase64(cachedData)
  }

  try {
    const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, url, {
      timeoutMs,
      maxResponseBytes: maxSizeBytes,
    })

    if (!response.ok) {
      throw new X509Error(`Failed to fetch CRL from ${url}: HTTP ${response.status} ${response.statusText}`)
    }

    const crlData = new Uint8Array(await response.arrayBuffer())

    // Cache the result if cache is available
    await cache.set(agentContext, cacheKey, TypedArrayEncoder.toBase64(crlData), cacheExpirySeconds).catch(() => null)

    return crlData
  } catch (error) {
    if (error instanceof X509Error) {
      throw error
    }
    throw new X509Error(`Failed to fetch CRL from ${url}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error instanceof Error ? error : undefined,
    })
  }
}
