import type { AgentContext } from '@credo-ts/core'
import type { CallbackContext, Jwk, JwkSet } from '@openid4vc/oauth2'
import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'
import { getPublishedJwk } from './utils'

/**
 * Returns a `getJwks` callback that resolves JWK Sets which are held by this agent itself, keyed by
 * the `jwks_uri` they are published on.
 *
 * This avoids the agent performing an HTTP request to its own `jwks_uri` to retrieve a key it
 * already has, which is what would otherwise happen when verifying an access token that this agent
 * issued itself.
 *
 * JWK Sets for any other `jwks_uri` are not resolved here. The callback returns `undefined` for
 * those, so oid4vc-ts fetches them as usual.
 */
export function getOid4vcLocalJwksCallback(
  agentContext: AgentContext,
  localJwks: Record<string, JwkSet>
): Pick<CallbackContext, 'getJwks'> {
  return {
    getJwks: (jwksUri) => {
      const jwks = localJwks[jwksUri]
      if (jwks) {
        agentContext.config.logger.trace(`Using local JWK Set for '${jwksUri}' instead of fetching it`)
      }

      return jwks
    },
  }
}

/**
 * The JWK Set the JWKs endpoint serves for an issuer: the current and previous access token signing keys, each with the
 * `kid` that access tokens carry, so tokens signed before a rotation still verify.
 */
export function getAccessTokenJwks(issuer: OpenId4VcIssuerRecord): JwkSet {
  return {
    keys: issuer.resolvedAccessTokenPublicJwks.map((key) => getPublishedJwk(key) as Jwk),
  }
}

/**
 * Returns the JWK Set that this agent publishes on `jwksUri` for an issuer's access token signing
 * keys, in exactly the shape the JWKs endpoint serves it.
 */
export function getLocalAccessTokenJwks(jwksUri: string, issuer: OpenId4VcIssuerRecord) {
  return { [jwksUri]: getAccessTokenJwks(issuer) } satisfies Record<string, JwkSet>
}
