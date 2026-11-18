import type { AgentContext } from '../../agent'
import { JsonEncoder, nowInSeconds } from '../../utils'
import { CacheModuleConfig } from '../cache'
import { TokenStatusListModuleConfig } from './TokenStatusListModuleConfig'

/**
 * The status list JWT of an SD-JWT VC, or the status list or identifier list CWT of an mdoc. A CWT is
 * cached as base64url, as cache values must survive JSON serialization.
 */
export type CachedStatusListType = 'statusListJwt' | 'statusListCwt' | 'identifierListCwt'

function statusListCacheKey(type: CachedStatusListType, uri: string) {
  return `token-status-list:${type}:v1:${uri}`
}

/**
 * Return the cached status list for a uri, or `null` if not cached.
 *
 * Status lists are public data, so they are cached in the global scope.
 */
export async function getCachedStatusList(
  agentContext: AgentContext,
  type: CachedStatusListType,
  uri: string
): Promise<string | null> {
  if (agentContext.resolve(TokenStatusListModuleConfig).statusListCacheExpirySeconds <= 0) return null

  const cache = agentContext.resolve(CacheModuleConfig).cache
  const cached = await cache.get<unknown>(agentContext, statusListCacheKey(type, uri), { scope: 'global' })
  return typeof cached === 'string' ? cached : null
}

/**
 * Cache a status list for as long as its `ttl` and `exp` (in seconds) allow, limited by
 * `statusListCacheExpirySeconds`. A token with neither claim is not cached.
 *
 * Callers must only cache a status list after its signature is verified, at the time it was fetched.
 */
export async function setCachedStatusList(
  agentContext: AgentContext,
  type: CachedStatusListType,
  uri: string,
  token: string,
  { exp, ttl }: { exp?: unknown; ttl?: unknown }
): Promise<void> {
  const maxExpirySeconds = agentContext.resolve(TokenStatusListModuleConfig).statusListCacheExpirySeconds
  if (maxExpirySeconds <= 0) return

  const timeToLive = typeof ttl === 'number' && ttl > 0 ? ttl : undefined
  const secondsUntilExpiry = typeof exp === 'number' ? exp - nowInSeconds() : undefined
  if (timeToLive === undefined && secondsUntilExpiry === undefined) return

  const expiresInSeconds = Math.floor(
    Math.min(timeToLive ?? Infinity, secondsUntilExpiry ?? Infinity, maxExpirySeconds)
  )
  if (expiresInSeconds <= 0) return

  const cache = agentContext.resolve(CacheModuleConfig).cache
  await cache.set(agentContext, statusListCacheKey(type, uri), token, expiresInSeconds, { scope: 'global' })
}

/**
 * Cache a status list JWT, see {@link setCachedStatusList}.
 */
export async function setCachedStatusListJwt(agentContext: AgentContext, uri: string, jwt: string): Promise<void> {
  // Once a release of @sd-jwt/sd-jwt-vc has identity-common-ts#462, cache from the `statusValidator`, which gets the decoded payload.
  let payload: { exp?: unknown; ttl?: unknown }
  try {
    payload = JsonEncoder.fromBase64Url(jwt.split('.')[1])
  } catch {
    return
  }

  await setCachedStatusList(agentContext, 'statusListJwt', uri, jwt, payload)
}
