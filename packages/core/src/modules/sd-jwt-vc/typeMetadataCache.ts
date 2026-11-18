import type { AgentContext } from '../../agent'
import { CacheModuleConfig } from '../cache'
import { SdJwtVcModuleConfig } from './SdJwtVcModuleConfig'

// With integrity metadata the document is static, so the entry is keyed by it
function typeMetadataCacheKey(vct: string, integrity: string | undefined) {
  return `sd-jwt-vc:type-metadata:v1:${vct}${integrity ? `#${integrity}` : ''}`
}

// With integrity metadata the document can't change. The expiry only keeps a shared cache from growing forever
const integrityTypeMetadataExpirySeconds = 24 * 60 * 60

// shortcut: only `max-age`, `no-store`, `no-cache` and `private` are read, add `Age`/`Expires` when a publisher needs them
function freshnessLifetimeSeconds(cacheControl: string | null) {
  // The cache is shared between agent contexts, so a `private` response is not stored
  if (!cacheControl || /no-store|no-cache|private/i.test(cacheControl)) return 0

  const maxAge = /(?:^|[\s,])max-age=(\d+)/i.exec(cacheControl)
  return maxAge ? Number(maxAge[1]) : 0
}

/**
 * Return the cached type metadata document for a vct, or `null` if not cached.
 *
 * Type metadata is public data, so it is cached in the global scope.
 */
export async function getCachedTypeMetadata(
  agentContext: AgentContext,
  vct: string,
  integrity: string | undefined
): Promise<Record<string, unknown> | null> {
  if (agentContext.resolve(SdJwtVcModuleConfig).typeMetadataCacheExpirySeconds <= 0) return null

  const cache = agentContext.resolve(CacheModuleConfig).cache
  const cached = await cache.get<unknown>(agentContext, typeMetadataCacheKey(vct, integrity), { scope: 'global' })
  return typeof cached === 'object' && cached !== null ? (cached as Record<string, unknown>) : null
}

/**
 * Cache a type metadata document. A document with verified integrity metadata is cached for 24
 * hours. Any other document is cached for the `max-age` of the `Cache-Control` header of its
 * response, limited by `typeMetadataCacheExpirySeconds`, and not at all without one.
 */
export async function setCachedTypeMetadata(
  agentContext: AgentContext,
  options: {
    vct: string
    integrity: string | undefined
    typeMetadata: Record<string, unknown>
    cacheControl: string | null
  }
): Promise<void> {
  const maxExpirySeconds = agentContext.resolve(SdJwtVcModuleConfig).typeMetadataCacheExpirySeconds
  if (maxExpirySeconds <= 0) return

  const expiresInSeconds = options.integrity
    ? integrityTypeMetadataExpirySeconds
    : Math.min(freshnessLifetimeSeconds(options.cacheControl), maxExpirySeconds)
  if (expiresInSeconds <= 0) return

  const cache = agentContext.resolve(CacheModuleConfig).cache
  await cache.set(
    agentContext,
    typeMetadataCacheKey(options.vct, options.integrity),
    options.typeMetadata,
    expiresInSeconds,
    {
      scope: 'global',
    }
  )
}
