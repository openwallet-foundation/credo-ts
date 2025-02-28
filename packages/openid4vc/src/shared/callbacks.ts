import type {
  CallbackContext,
  ClientAuthenticationCallback,
  SignJwtCallback,
  VerifyJwtCallback,
} from '@animo-id/oauth2'
import type { AgentContext } from '@credo-ts/core'
import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'

import { clientAuthenticationDynamic, clientAuthenticationNone } from '@animo-id/oauth2'
import { CredoError, Hasher, JsonEncoder, JwsService, getJwkFromJson, getJwkFromKey } from '@credo-ts/core'

import { getKeyFromDid } from './utils'

export function getOid4vciJwtVerifyCallback(agentContext: AgentContext): VerifyJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { compact }) => {
    const { isValid } = await jwsService.verifyJws(agentContext, {
      jws: compact,
      // Only handles kid as did resolution. JWK is handled by jws service
      jwkResolver: async () => {
        if (signer.method === 'jwk') {
          return getJwkFromJson(signer.publicJwk)
        }
        if (signer.method === 'did') {
          const key = await getKeyFromDid(agentContext, signer.didUrl)
          return getJwkFromKey(key)
        }

        throw new CredoError(`Unexpected call to jwk resolver for signer method ${signer.method}`)
      },
    })

    return isValid
  }
}

export function getOid4vciJwtSignCallback(agentContext: AgentContext): SignJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { payload, header }) => {
    if (signer.method === 'custom' || signer.method === 'x5c') {
      throw new CredoError(`Jwt signer method 'custom' and 'x5c' are not supported for jwt signer.`)
    }

    const key =
      signer.method === 'did' ? await getKeyFromDid(agentContext, signer.didUrl) : getJwkFromJson(signer.publicJwk).key
    const jwk = getJwkFromKey(key)

    if (!jwk.supportsSignatureAlgorithm(signer.alg)) {
      throw new CredoError(`key type '${jwk.keyType}', does not support the JWS signature alg '${signer.alg}'`)
    }

    const jwt = await jwsService.createJwsCompact(agentContext, {
      protectedHeaderOptions: {
        ...header,
        jwk: header.jwk ? getJwkFromJson(header.jwk) : undefined,
      },
      payload: JsonEncoder.toBuffer(payload),
      key,
    })

    return jwt
  }
}

export function getOid4vciCallbacks(agentContext: AgentContext) {
  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => agentContext.wallet.getRandomValues(length),
    signJwt: getOid4vciJwtSignCallback(agentContext),
    clientAuthentication: clientAuthenticationNone(),
    verifyJwt: getOid4vciJwtVerifyCallback(agentContext),
    fetch: agentContext.config.agentDependencies.fetch,
  } satisfies Partial<CallbackContext>
}

/**
 * Allows us to authenticate when making requests to an external
 * authorizatin server
 */
export function dynamicOid4vciClientAuthentication(
  agentContext: AgentContext,
  issuerRecord: OpenId4VcIssuerRecord
): ClientAuthenticationCallback {
  return (callbackOptions) => {
    const authorizationServer = issuerRecord.authorizationServerConfigs?.find(
      (a) => a.issuer === callbackOptions.authorizationServerMetata.issuer
    )

    if (!authorizationServer) {
      // No client authentication if authorization server is not configured
      agentContext.config.logger.debug(
        `Unknown authorization server '${callbackOptions.authorizationServerMetata.issuer}' for issuer '${issuerRecord.issuerId}' for request to '${callbackOptions.url}'`
      )
      return
    }

    if (!authorizationServer.clientAuthentication) {
      throw new CredoError(
        `Unable to authenticate to authorization server '${authorizationServer.issuer}' for issuer '${issuerRecord.issuerId}' for request to '${callbackOptions.url}'. Make sure to configure a 'clientId' and 'clientSecret' for the authorization server on the issuer record.`
      )
    }

    return clientAuthenticationDynamic({
      clientId: authorizationServer.clientAuthentication.clientId,
      clientSecret: authorizationServer.clientAuthentication.clientSecret,
    })(callbackOptions)
  }
}
