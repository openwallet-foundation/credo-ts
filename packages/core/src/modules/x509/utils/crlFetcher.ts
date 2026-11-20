import type { AgentContext } from '../../../agent'
import { CacheModuleConfig } from '../../cache'
import { X509Error } from '../X509Error'
import { isX509CrlSummary, type X509CrlSummary } from './crlSummary'

export interface CrlFetchOptions {
  url: string
  agentContext: AgentContext

  /**
   * Maximum CRL fetch time after which request will be aborted
   */
  timeoutMs: number

  /**
   * Maximum size in bytes for CRL downloads
   */
  maxSizeBytes: number
}

// Versioned so future summary shape changes can bump the key. Distinct from the legacy
// `x509:crl:${url}` raw-bytes key, which this version no longer reads or writes but which older
// Credo versions sharing the cache may still use.
function crlSummaryCacheKey(url: string): string {
  return `x509:crl-summary:v1:${url}`
}

/**
 * Fetches a CRL from a given URL with size limit and timeout enforcement.
 *
 * This does NOT cache: caching is the responsibility of the caller, which should only cache a CRL
 * after it has been verified (see {@link setCachedCrlSummary}), so unverified or expired CRLs are
 * never persisted.
 *
 * @throws {X509Error} If the fetch fails, returns a non-OK status, or exceeds the size limit
 */
export async function fetchCrl(options: CrlFetchOptions): Promise<Uint8Array> {
  const { url, timeoutMs, agentContext, maxSizeBytes } = options

  try {
    const response = await agentContext.config.fetch(url, {
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
 * Return the cached verified CRL summary for a URL, or `null` if not cached. Values that do not
 * match the expected summary shape are treated as a cache miss, never as an error.
 *
 * Summaries are cached in the global scope: CRLs are public data, shared across all agent contexts.
 */
export async function getCachedCrlSummary(agentContext: AgentContext, url: string): Promise<X509CrlSummary | null> {
  const cache = agentContext.resolve(CacheModuleConfig).cache
  const cached = await cache.get<unknown>(agentContext, crlSummaryCacheKey(url), { scope: 'global' }).catch(() => null)
  return isX509CrlSummary(cached) ? cached : null
}

/**
 * Cache the summary of a verified CRL for a URL.
 *
 * Callers must only cache summaries derived from CRLs that have passed verification, and should
 * derive `expiresInSeconds` from the CRL's `nextUpdate` so an expired CRL is never served from the
 * cache.
 *
 * Summaries are cached in the global scope: CRLs are public data, shared across all agent contexts.
 */
export async function setCachedCrlSummary(
  agentContext: AgentContext,
  url: string,
  summary: X509CrlSummary,
  expiresInSeconds: number
): Promise<void> {
  if (expiresInSeconds <= 0) return
  const cache = agentContext.resolve(CacheModuleConfig).cache
  await cache
    .set(agentContext, crlSummaryCacheKey(url), summary, expiresInSeconds, { scope: 'global' })
    .catch(() => null)
}

function crlDownloadFailuresCacheKey(url: string): string {
  return `x509:crl-download-failures:v1:${url}`
}

export interface X509CrlDownloadFailures {
  /** The error of the last failed download */
  error: string
  count: number
  /** Time of the last failed download, in milliseconds since the epoch */
  failedAt: number
}

/**
 * Return the failed downloads of the CRL at a URL since its last successful download, or `null` when
 * there are none.
 */
export async function getCachedCrlDownloadFailures(
  agentContext: AgentContext,
  url: string
): Promise<X509CrlDownloadFailures | null> {
  const cache = agentContext.resolve(CacheModuleConfig).cache
  return cache.get<X509CrlDownloadFailures>(agentContext, crlDownloadFailuresCacheKey(url), { scope: 'global' })
}

/**
 * Remember the failed downloads of the CRL at a URL for `expiresInSeconds`, or forget them when
 * `failures` is `null`.
 */
export async function setCachedCrlDownloadFailures(
  agentContext: AgentContext,
  url: string,
  failures: X509CrlDownloadFailures | null,
  expiresInSeconds: number
): Promise<void> {
  const cache = agentContext.resolve(CacheModuleConfig).cache
  const key = crlDownloadFailuresCacheKey(url)
  if (!failures) return cache.remove(agentContext, key, { scope: 'global' })
  if (expiresInSeconds <= 0) return
  await cache.set(agentContext, key, failures, expiresInSeconds, { scope: 'global' })
}
