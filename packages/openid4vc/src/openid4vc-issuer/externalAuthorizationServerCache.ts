import { type AgentContext, CacheModuleConfig } from '@credo-ts/core'
import {
  type AuthorizationServerMetadata,
  type CallbackContext,
  decodeJwt,
  fetchAuthorizationServerMetadata,
  fetchJwks,
  type JwkSet,
} from '@openid4vc/oauth2'
import type { Fetch } from '@openid4vc/utils'

/**
 * The `iss` and `kid` of a JWT access token, read before the token is verified. Only use them to
 * select what to fetch, never to trust the token.
 */
export function decodeUnverifiedAccessToken(authorizationHeader: string | undefined): {
  issuer?: string
  kid?: string
} {
  const accessToken = authorizationHeader?.split(' ', 2)[1]
  if (!accessToken) return {}

  try {
    const { header, payload } = decodeJwt({ jwt: accessToken })
    return {
      issuer: typeof payload.iss === 'string' ? payload.iss : undefined,
      kid: typeof header.kid === 'string' ? header.kid : undefined,
    }
  } catch {
    // An opaque access token
    return {}
  }
}

// The cooldown is the default of `createRemoteJWKSet` in jose. A few fetches are allowed within it, so
// a JWK Set that did not have a rotated key yet is tried again
const jwksRefetchCooldownInSeconds = 30
const jwksRefetchesPerCooldown = 3

/**
 * Callbacks that serve the metadata and JWK Set of external authorization servers from the agent
 * cache. Both are public data, so they are cached in the global scope.
 *
 * A cached JWK Set without `jwksKid` is fetched again, so a rotated key is picked up. Only a few
 * times per cooldown, so access tokens with a made up `kid` can't cause a fetch per request.
 */
export function getExternalAuthorizationServerCacheCallbacks(
  agentContext: AgentContext,
  expiryInSeconds: number,
  jwksKid?: string
): Pick<CallbackContext, 'getAuthorizationServerMetadata' | 'getJwks'> {
  if (expiryInSeconds <= 0) return {}

  const cache = agentContext.resolve(CacheModuleConfig).cache
  const fetch: Fetch = (url, init) => agentContext.config.fetch(url, init)
  const get = <T>(key: string) => cache.get<T>(agentContext, key, { scope: 'global' })
  const set = (key: string, value: unknown) => cache.set(agentContext, key, value, expiryInSeconds, { scope: 'global' })

  return {
    getAuthorizationServerMetadata: async (issuer) => {
      const key = `openid4vc:authorization-server-metadata:${issuer}`
      const cached = await get<AuthorizationServerMetadata>(key)
      if (cached) return cached

      const metadata = await fetchAuthorizationServerMetadata(issuer, fetch)
      if (metadata) await set(key, metadata)
      return metadata
    },
    getJwks: async (jwksUri) => {
      const key = `openid4vc:authorization-server-jwks:${jwksUri}`
      const cached = await get<{ jwks: JwkSet; cooldownStartedAt: number; refetches: number }>(key)
      const isInCooldown = cached && Date.now() - cached.cooldownStartedAt < jwksRefetchCooldownInSeconds * 1000
      if (cached) {
        const hasKid = !jwksKid || cached.jwks.keys.some((jwk) => jwk.kid === jwksKid)
        if (hasKid || (isInCooldown && cached.refetches >= jwksRefetchesPerCooldown)) return cached.jwks
      }

      const jwks = await fetchJwks(jwksUri, fetch)
      await set(
        key,
        isInCooldown
          ? { jwks, cooldownStartedAt: cached.cooldownStartedAt, refetches: cached.refetches + 1 }
          : { jwks, cooldownStartedAt: Date.now(), refetches: 0 }
      )
      return jwks
    },
  }
}
