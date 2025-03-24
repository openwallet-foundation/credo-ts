import type { AgentContext } from '@credo-ts/core'
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
import { clientAuthenticationDynamic, clientAuthenticationNone, decodeJwtHeader } from '@openid4vc/oauth2'

import { resolveTrustChains } from '@openid-federation/core'
import { getKeyFromDid } from './utils'

export function getOid4vcJwtVerifyCallback(
  agentContext: AgentContext,
  options?: {
    trustedCertificates?: string[]
    trustedFederationEntityIds?: string[]

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

    // FIXME: extend signer to include entityId (`iss` field or `client_id`)
    if (signer.method === 'federation') {
      // We use the `client_id`
      if (!options?.isAuthorizationRequestJwt) {
        agentContext.config.logger.error(
          'Verifying JWTs signed as a federation entity is only allow for signed authorization requests'
        )
        return { verified: false }
      }

      // I think this check is already in oid4vp lib
      if (
        !payload.client_id ||
        typeof payload.client_id !== 'string' ||
        !(
          payload.client_id.startsWith('https:') ||
          (payload.client_id.startsWith('http:') && agentContext.config.allowInsecureHttpUrls)
        )
      ) {
        agentContext.config.logger.error("Expected 'client_id' to be a valid OpenID Federation entity id.")
        return { verified: false }
      }

      const trustedEntityIds = options?.trustedFederationEntityIds
      if (!trustedEntityIds) {
        agentContext.config.logger.error(
          'No trusted entity ids provided but is required for verification of JWTs signed by a federation entity.'
        )
        return { verified: false }
      }

      const entityId = payload.client_id
      const validTrustChains = await resolveTrustChains({
        entityId,
        // FIXME: need option to pass a trust chain to the library
        // trustChain: payload.trust_chain,
        trustAnchorEntityIds: trustedEntityIds,
        verifyJwtCallback: async ({ jwt, jwk }) => {
          const res = await jwsService.verifyJws(agentContext, {
            jws: jwt,
            jwkResolver: () => getJwkFromJson(jwk),
          })

          return res.isValid
        },
      })
      // When the chain is already invalid we can return false immediately
      if (validTrustChains.length === 0) {
        agentContext.config.logger.error(`${entityId} is not part of a trusted federation.`)
        return { verified: false }
      }

      // Pick the first valid trust chain for validation of the leaf entity jwks
      const { leafEntityConfiguration } = validTrustChains[0]

      // TODO: No support yet for signed jwks and external jwks
      const rpSigningKeys = leafEntityConfiguration?.metadata?.openid_relying_party?.jwks?.keys
      const rpSignerKeyJwkJson = rpSigningKeys?.find((key) => key.kid === signer.kid)
      if (!rpSignerKeyJwkJson) {
        agentContext.config.logger.error(
          `Key with kid '${signer.kid}' not found in jwks of openid_relying_party configuration for entity ${entityId}.`
        )
        return {
          verified: false,
        }
      }

      const rpSignerJwk = getJwkFromJson(rpSignerKeyJwkJson)

      const res = await jwsService.verifyJws(agentContext, {
        jws: compact,
        // FIXME: we should ensure the key is used, as if the jwt contains a jwk we will just
        // use that, and that is quite a security risk
        jwkResolver: () => rpSignerJwk,
      })
      if (!res.isValid) {
        agentContext.config.logger.error(`${entityId} does not match the expected signing key.`)
      }

      if (!res.isValid) {
        return { verified: false }
      }

      // TODO: There is no check yet for the policies
      return { verified: true, signerJwk: rpSignerJwk.toJson() }
    }

    const { isValid, signerKeys } = await jwsService.verifyJws(agentContext, {
      jws: compact,
      trustedCertificates,
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
    if (signer.method === 'custom') {
      throw new CredoError(`Jwt signer method 'custom' is not supported for jwt signer.`)
    }

    if (signer.method === 'federation') {
      // We use the fingerprint as the kid. This will need to be updated in the future
      const key = Key.fromFingerprint(signer.kid)
      const jwk = getJwkFromKey(key)

      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: {
          ...header,
          alg: signer.alg,
          kid: signer.kid,
          trust_chain: signer.trustChain,
          jwk: undefined,
        },
        payload: JwtPayload.fromJson(payload),
        key: jwk.key,
      })

      return { jwt: jws, signerJwk: jwk.toJson() }
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
    trustedFederationEntityIds?: string[]
    isVerifyOpenId4VpAuthorizationRequest?: boolean
  }
) {
  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => agentContext.wallet.getRandomValues(length),
    signJwt: getOid4vcJwtSignCallback(agentContext),
    clientAuthentication: clientAuthenticationNone(),
    verifyJwt: getOid4vcJwtVerifyCallback(agentContext, {
      trustedCertificates: options?.trustedCertificates,
      trustedFederationEntityIds: options?.trustedFederationEntityIds,
      isAuthorizationRequestJwt: options?.isVerifyOpenId4VpAuthorizationRequest,
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
