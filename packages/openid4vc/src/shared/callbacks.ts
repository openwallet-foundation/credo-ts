import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'
import type { AgentContext } from '@credo-ts/core'
import type {
  CallbackContext,
  ClientAuthenticationCallback,
  SignJwtCallback,
  VerifyJwtCallback,
  DecryptJweCallback,
  EncryptJweCallback,
} from '@openid4vc/oauth2'

import {
  Buffer,
  Key,
  TypedArrayEncoder,
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
import { clientAuthenticationDynamic, clientAuthenticationNone } from '@openid4vc/oauth2'

import { getKeyFromDid } from './utils'

export function getOid4vcJwtVerifyCallback(
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

export function getOid4vcEncryptJweCallback(agentContext: AgentContext): EncryptJweCallback {
  return async (jweEncryptor, compact) => {
    if (jweEncryptor.method !== 'jwk') {
      throw new CredoError(
        `Jwt encryption method '${jweEncryptor.method}' is not supported for jwt signer. Only 'jwk' is supported.`
      )
    }

    const jwk = getJwkFromJson(jweEncryptor.publicJwk)
    const key = jwk.key

    if (jweEncryptor.alg !== 'ECDH-ES') {
      throw new CredoError("Only 'ECDH-ES' is supported as 'alg' value for JARM response encryption")
    }

    if (jweEncryptor.enc !== 'A256GCM' && jweEncryptor.enc !== 'A128GCM' && jweEncryptor.enc !== 'A128CBC-HS256') {
      throw new CredoError(
        "Only 'A256GCM', 'A128GCM', and 'A128CBC-HS256' is supported as 'enc' value for JARM response encryption"
      )
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
      header: { kid: jweEncryptor.publicJwk.kid },
      encryptionAlgorithm: jweEncryptor.enc,
      apu: jweEncryptor.apu ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(jweEncryptor.apu)) : undefined,
      apv: jweEncryptor.apv ? TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(jweEncryptor.apv)) : undefined,
    })

    return { encryptionJwk: jweEncryptor.publicJwk, jwe }
  }
}

export function getOid4vcDecryptJweCallback(agentContext: AgentContext): DecryptJweCallback {
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
      decryptionJwk: getJwkFromKey(key).toJson(),
      payload: decryptedPayload,
      header: decodedHeader,
    }
  }
}

export function getOid4vcJwtSignCallback(agentContext: AgentContext): SignJwtCallback {
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

export function getOid4vcCallbacks(agentContext: AgentContext, trustedCertificates?: string[]) {
  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => agentContext.wallet.getRandomValues(length),
    signJwt: getOid4vcJwtSignCallback(agentContext),
    clientAuthentication: clientAuthenticationNone(),
    verifyJwt: getOid4vcJwtVerifyCallback(agentContext, trustedCertificates),
    fetch: agentContext.config.agentDependencies.fetch,
    encryptJwe: getOid4vcEncryptJweCallback(agentContext),
    decryptJwe: getOid4vcDecryptJweCallback(agentContext),
    getX509CertificateMetadata: (certificate: string) => {
      const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: [certificate] })
      return {
        sanDnsNames: leafCertificate.sanDnsNames,
        sanUriNames: leafCertificate.sanUriNames,
      }
    },
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
