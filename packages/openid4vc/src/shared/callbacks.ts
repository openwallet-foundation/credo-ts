import type {
  CallbackContext,
  ClientAuthenticationCallback,
  SignJwtCallback,
  VerifyJwtCallback,
} from '@animo-id/oauth2'
import type { AgentContext } from '@credo-ts/core'
import { Buffer, Key, TypedArrayEncoder } from '@credo-ts/core'
import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'

import { clientAuthenticationDynamic, clientAuthenticationNone } from '@animo-id/oauth2'
import {
  CredoError,
  getJwkFromJson,
  getJwkFromKey,
  Hasher,
  JsonEncoder,
  JwsService,
  JwtPayload,
  KeyType,
  X509Service,
} from '@credo-ts/core'

import { DecryptJweCallback, EncryptJweCallback } from '@animo-id/oauth2/src/callbacks.js'
import { getKeyFromDid } from './utils'

export function getOid4vciJwtVerifyCallback(
  agentContext: AgentContext,
  trustedCertificates?: string[]
): VerifyJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { compact }) => {
    const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
      jws: compact,
      trustedCertificates,
      // Only handles kid as did resolution. JWK is handled by jws service
      jwkResolver: async () => {
        if (signer.method === 'jwk') {
          return getJwkFromJson(signer.publicJwk)
        } else if (signer.method === 'did') {
          const key = await getKeyFromDid(agentContext, signer.didUrl)
          return getJwkFromKey(key)
        }

        throw new CredoError(`Unexpected call to jwk resolver for signer method ${signer.method}`)
      },
    })

    if (!isValid) {
      return { verified: false, signerJwk: undefined }
    }

    const signerKey = signerKeys[0]
    const signerJwk = getJwkFromKey(signerKey).toJson()
    if (signer.method === 'did') {
      signerJwk.kid = signer.didUrl
    }

    return { verified: true, signerJwk }
  }
}

export function getOid4vciEncryptJwtCallback(agentContext: AgentContext): EncryptJweCallback {
  return async (jwtEncryptor, compact) => {
    if (jwtEncryptor.method !== 'jwk') {
      throw new CredoError(
        `Jwt encryption method '${jwtEncryptor.method}' is not supported for jwt signer. Only 'jwk' is supported.`
      )
    }

    const jwk = getJwkFromJson(jwtEncryptor.publicJwk)
    const key = jwk.key

    if (jwtEncryptor.alg !== 'ECDH-ES') {
      throw new CredoError("Only 'ECDH-ES' is supported as 'alg' value for JARM response encryption")
    }

    if (jwtEncryptor.enc !== 'A256GCM') {
      throw new CredoError("Only 'A256GCM' is supported as 'enc' value for JARM response encryption")
    }

    if (key.keyType !== KeyType.P256) {
      throw new CredoError(`Only '${KeyType.P256}' key type is supported for JARM response encryption`)
    }

    if (!agentContext.wallet.directEncryptCompactJweEcdhEs) {
      throw new CredoError(
        'Cannot decrypt Jarm Response, wallet does not support directEncryptCompactJweEcdhEs. You need to upgrade your wallet implementation.'
      )
    }

    const jwe = await agentContext.wallet.directEncryptCompactJweEcdhEs({
      data: Buffer.from(compact),
      recipientKey: key,
      header: { kid: jwtEncryptor.publicJwk.kid },
      encryptionAlgorithm: jwtEncryptor.enc,
      apu: jwtEncryptor.apu ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(jwtEncryptor.apu)) : undefined,
      apv: jwtEncryptor.apv ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(jwtEncryptor.apv)) : undefined,
    })

    return { encryptionJwk: jwtEncryptor.publicJwk, jwe }
  }
}

export function getOid4vciDecryptJwtCallback(agentContext: AgentContext): DecryptJweCallback {
  return async (jwe, options) => {
    const [header] = jwe.split('.')
    const decodedHeader = JsonEncoder.fromBase64(header)

    const key = Key.fromFingerprint(options?.jwk.kid ?? decodedHeader.kid)
    if (!agentContext.wallet.directDecryptCompactJweEcdhEs) {
      throw new CredoError('Cannot decrypt Jarm Response, wallet does not support directDecryptCompactJweEcdhEs')
    }

    let decryptedPayload: string

    try {
      const decrypted = await agentContext.wallet.directDecryptCompactJweEcdhEs({ compactJwe: jwe, recipientKey: key })
      decryptedPayload = TypedArrayEncoder.toUtf8String(decrypted.data)
    } catch (error) {
      return {
        decrypted: false,
        encryptionJwk: options?.jwk,
        payload: undefined,
        header: decodedHeader,
      }
    }

    return {
      decrypted: true,
      encryptionJwk: getJwkFromKey(key).toJson(),
      payload: decryptedPayload,
      header: decodedHeader,
    }
  }
}

export function getOid4vciJwtSignCallback(agentContext: AgentContext): SignJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { payload, header }) => {
    if (signer.method === 'custom' || signer.method === 'trustChain') {
      throw new CredoError(`Jwt signer method 'custom' and 'x5c' are not supported for jwt signer.`)
    }

    if (signer.method === 'x5c') {
      const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: signer.x5c })

      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: { ...header, alg: signer.alg, jwk: undefined },
        payload: JwtPayload.fromJson(payload),
        key: leafCertificate.publicKey,
      })

      return { jwt: jws, signerJwk: getJwkFromKey(leafCertificate.publicKey).toJson() }
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

    return { jwt, signerJwk: getJwkFromKey(key).toJson() }
  }
}

export function getOid4vciCallbacks(agentContext: AgentContext, trustedCertificates?: string[]) {
  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => agentContext.wallet.getRandomValues(length),
    signJwt: getOid4vciJwtSignCallback(agentContext),
    clientAuthentication: clientAuthenticationNone(),
    verifyJwt: getOid4vciJwtVerifyCallback(agentContext, trustedCertificates),
    fetch: agentContext.config.agentDependencies.fetch,
    encryptJwe: getOid4vciEncryptJwtCallback(agentContext),
    decryptJwe: getOid4vciDecryptJwtCallback(agentContext),
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
