import { AgentContext, JwaSignatureAlgorithm, JwsSignerWithJwk } from '@credo-ts/core'
import type {
  CallbackContext,
  ClientAuthenticationCallback,
  DecryptJweCallback,
  EncryptJweCallback,
  SignJwtCallback,
  VerifyJwtCallback,
} from '@openid4vc/oauth2'
import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'

import {
  Buffer,
  CredoError,
  Hasher,
  JsonEncoder,
  JwsService,
  JwtPayload,
  Key,
  KeyType,
  TypedArrayEncoder,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
  getJwkFromJson,
  getJwkFromKey,
} from '@credo-ts/core'
import { clientAuthenticationDynamic, decodeJwtHeader } from '@openid4vc/oauth2'

import { getKeyFromDid } from './utils'

export function getOid4vcJwtVerifyCallback(
  agentContext: AgentContext,
  options?: {
    trustedCertificates?: string[]

    issuanceSessionId?: string

    /**
     * Whether this verification callback should assume a JAR authorization is verified
     * Starting from OID4VP draft 24 the JAR must use oauth-authz-req+jwt header typ
     * but for backwards compatiblity we need to also handle the case where the header typ is different
     * @default false
     */
    isAuthorizationRequestJwt?: boolean
  }
): VerifyJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { compact, header, payload }) => {
    let trustedCertificates = options?.trustedCertificates
    if (
      signer.method === 'x5c' &&
      (header.typ === 'oauth-authz-req+jwt' || options?.isAuthorizationRequestJwt) &&
      !trustedCertificates
    ) {
      const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
      const certificateChain = signer.x5c?.map((cert) => X509Certificate.fromEncodedCertificate(cert))

      trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
        certificateChain,
        verification: {
          type: 'oauth2SecuredAuthorizationRequest',
          authorizationRequest: {
            jwt: compact,
            payload: JwtPayload.fromJson(payload),
          },
        },
      })
    }

    if (
      signer.method === 'x5c' &&
      (header.typ === 'keyattestation+jwt' || header.typ === 'key-attestation+jwt') &&
      options?.issuanceSessionId &&
      !trustedCertificates
    ) {
      const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
      const certificateChain = signer.x5c?.map((cert) => X509Certificate.fromEncodedCertificate(cert))

      trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
        certificateChain,
        verification: {
          type: 'openId4VciKeyAttestation',
          openId4VcIssuanceSessionId: options.issuanceSessionId,
          keyAttestation: {
            jwt: compact,
            payload: JwtPayload.fromJson(payload),
          },
        },
      })
    }

    if (
      signer.method === 'x5c' &&
      header.typ === 'oauth-client-attestation+jwt' &&
      options?.issuanceSessionId &&
      !trustedCertificates
    ) {
      const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
      const certificateChain = signer.x5c?.map((cert) => X509Certificate.fromEncodedCertificate(cert))

      trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
        certificateChain,
        verification: {
          type: 'oauth2ClientAttestation',
          openId4VcIssuanceSessionId: options.issuanceSessionId,
          clientAttestation: {
            jwt: compact,
            payload: JwtPayload.fromJson(payload),
          },
        },
      })
    }

    const alg = signer.alg as JwaSignatureAlgorithm
    if (!Object.values(JwaSignatureAlgorithm).includes(alg)) {
      throw new CredoError(`Unsupported jwa signatre algorithm '${alg}'`)
    }

    const jwsSigner: JwsSignerWithJwk | undefined =
      signer.method === 'did'
        ? {
            method: 'did',
            didUrl: signer.didUrl,
            jwk: getJwkFromKey(await getKeyFromDid(agentContext, signer.didUrl)),
          }
        : signer.method === 'jwk'
          ? {
              method: 'jwk',
              jwk: getJwkFromJson(signer.publicJwk),
            }
          : signer.method === 'x5c'
            ? {
                method: 'x5c',
                x5c: signer.x5c,
                jwk: getJwkFromKey(X509Certificate.fromEncodedCertificate(signer.x5c[0]).publicKey),
              }
            : undefined

    if (!jwsSigner) {
      throw new CredoError(`Unable to verify jws with unsupported jws signer method '${signer.method}'`)
    }

    const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
      jws: compact,
      trustedCertificates,
      jwsSigner,
    })

    if (!isValid) {
      return { verified: false, signerJwk: undefined }
    }

    const signerJwk = jwsSigners[0].jwk.toJson()
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
    const { header } = decodeJwtHeader({ jwt: jwe })

    const kid = options?.jwk?.kid ?? header.kid
    if (!kid) {
      throw new CredoError('Uanbel to decrypt jwe. No kid or jwk found')
    }

    const key = Key.fromFingerprint(kid)
    if (!agentContext.wallet.directDecryptCompactJweEcdhEs) {
      throw new CredoError('Cannot decrypt Jarm Response, wallet does not support directDecryptCompactJweEcdhEs')
    }

    let decryptedPayload: string

    try {
      const decrypted = await agentContext.wallet.directDecryptCompactJweEcdhEs({ compactJwe: jwe, recipientKey: key })
      decryptedPayload = TypedArrayEncoder.toUtf8String(decrypted.data)
    } catch (_error) {
      return {
        decrypted: false,
        encryptionJwk: options?.jwk,
        payload: undefined,
        header,
      }
    }

    return {
      decrypted: true,
      decryptionJwk: getJwkFromKey(key).toJson(),
      payload: decryptedPayload,
      header,
    }
  }
}

export function getOid4vcJwtSignCallback(agentContext: AgentContext): SignJwtCallback {
  const jwsService = agentContext.dependencyManager.resolve(JwsService)

  return async (signer, { payload, header }) => {
    if (signer.method === 'custom' || signer.method === 'federation') {
      throw new CredoError(`Jwt signer method 'custom' and 'federation' are not supported for jwt signer.`)
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

export function getOid4vcCallbacks(
  agentContext: AgentContext,
  options?: {
    trustedCertificates?: string[]
    isVerifyOpenId4VpAuthorizationRequest?: boolean
    issuanceSessionId?: string
  }
) {
  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => agentContext.wallet.getRandomValues(length),
    signJwt: getOid4vcJwtSignCallback(agentContext),
    clientAuthentication: () => {
      throw new CredoError('Did not expect client authentication to be called.')
    },
    verifyJwt: getOid4vcJwtVerifyCallback(agentContext, {
      trustedCertificates: options?.trustedCertificates,
      isAuthorizationRequestJwt: options?.isVerifyOpenId4VpAuthorizationRequest,
      issuanceSessionId: options?.issuanceSessionId,
    }),
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
      (a) => a.issuer === callbackOptions.authorizationServerMetadata.issuer
    )

    if (!authorizationServer) {
      // No client authentication if authorization server is not configured
      agentContext.config.logger.debug(
        `Unknown authorization server '${callbackOptions.authorizationServerMetadata.issuer}' for issuer '${issuerRecord.issuerId}' for request to '${callbackOptions.url}'`
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
