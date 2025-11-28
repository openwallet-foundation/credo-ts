import {
  AgentContext,
  Buffer,
  CredoError,
  Hasher,
  JsonEncoder,
  JwsService,
  type JwsSignerWithJwk,
  JwtPayload,
  Kms,
  TypedArrayEncoder,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
} from '@credo-ts/core'
import type {
  CallbackContext,
  ClientAuthenticationCallback,
  DecryptJweCallback,
  EncryptJweCallback,
  Jwk,
  SignJwtCallback,
  VerifyJwtCallback,
} from '@openid4vc/oauth2'
import { clientAuthenticationDynamic, decodeJwtHeader } from '@openid4vc/oauth2'
import type { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository'

import { getPublicJwkFromDid } from './utils'

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

    if (signer.method === 'x5c' && header.typ === 'openidvci-issuer-metadata+jwt' && !trustedCertificates) {
      const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
      const certificateChain = signer.x5c?.map((cert) => X509Certificate.fromEncodedCertificate(cert))

      trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
        certificateChain,
        verification: {
          type: 'openId4VciCredentialIssuerMetadata',
          credentialIssuerMetadata: {
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

    const alg = signer.alg as Kms.KnownJwaSignatureAlgorithm
    if (!Object.values(Kms.KnownJwaSignatureAlgorithms).includes(alg)) {
      throw new CredoError(`Unsupported jwa signatre algorithm '${alg}'`)
    }

    const jwsSigner: JwsSignerWithJwk | undefined =
      signer.method === 'did'
        ? {
            method: 'did',
            didUrl: signer.didUrl,
            jwk: await getPublicJwkFromDid(agentContext, signer.didUrl),
          }
        : signer.method === 'jwk'
          ? {
              method: 'jwk',
              jwk: Kms.PublicJwk.fromUnknown(signer.publicJwk),
            }
          : signer.method === 'x5c'
            ? {
                method: 'x5c',
                x5c: signer.x5c,
                jwk: X509Certificate.fromEncodedCertificate(signer.x5c[0]).publicJwk,
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

    const signerJwk = jwsSigners[0].jwk.toJson() as Jwk
    return { verified: true, signerJwk }
  }
}

export function getOid4vcEncryptJweCallback(agentContext: AgentContext): EncryptJweCallback {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

  return async (jweEncryptor, compact) => {
    if (jweEncryptor.method !== 'jwk') {
      throw new CredoError(
        `Jwt encryption method '${jweEncryptor.method}' is not supported for jwt signer. Only 'jwk' is supported.`
      )
    }

    // TODO: we should probably add a key id or ference to the jweEncryptor/jwsSigner in
    // oid4vc-ts so we can keep a reference to the key
    const jwk = Kms.PublicJwk.fromUnknown(jweEncryptor.publicJwk)
    if (!jwk.hasKeyId) {
      throw new CredoError('Expected kid to be defined on the JWK')
    }

    if (jweEncryptor.alg !== 'ECDH-ES') {
      throw new CredoError("Only 'ECDH-ES' is supported as 'alg' value for JARM response encryption")
    }

    if (jweEncryptor.enc !== 'A256GCM' && jweEncryptor.enc !== 'A128GCM' && jweEncryptor.enc !== 'A128CBC-HS256') {
      throw new CredoError(
        "Only 'A256GCM', 'A128GCM', and 'A128CBC-HS256' is supported as 'enc' value for JARM response encryption"
      )
    }

    const jwkJson = jwk.toJson()
    if (jwkJson.kty !== 'EC' && jwkJson.kty !== 'OKP') {
      throw new CredoError(`Expected EC or OKP jwk for encryption, found ${Kms.getJwkHumanDescription(jwkJson)}`)
    }

    if (jwkJson.crv === 'Ed25519') {
      throw new CredoError(`Expected ${jwkJson.kty} with crv X25519, found ${Kms.getJwkHumanDescription(jwkJson)}`)
    }

    // TODO: create a JWE service that handles this
    const ephmeralKey = await kms.createKey({
      type: jwkJson,
    })

    try {
      const header = {
        kid: jweEncryptor.publicJwk.kid,
        apu: jweEncryptor.apu,
        apv: jweEncryptor.apv,
        enc: jweEncryptor.enc,
        alg: 'ECDH-ES',
        epk: ephmeralKey.publicJwk,
      }
      const encodedHeader = JsonEncoder.toBase64URL(header)

      const encrypted = await kms.encrypt({
        key: {
          keyAgreement: {
            // FIXME: We can make the keyId optional for ECDH-ES
            // That way we don't have to store the key
            keyId: ephmeralKey.keyId,
            algorithm: 'ECDH-ES',
            apu: jweEncryptor.apu ? TypedArrayEncoder.fromBase64(jweEncryptor.apu) : undefined,
            apv: jweEncryptor.apv ? TypedArrayEncoder.fromBase64(jweEncryptor.apv) : undefined,
            externalPublicJwk: jwkJson,
          },
        },
        data: Buffer.from(compact),
        encryption: {
          algorithm: jweEncryptor.enc,
          aad: Buffer.from(encodedHeader),
        },
      })

      if (!encrypted.iv || !encrypted.tag) {
        throw new CredoError("Expected 'iv' and 'tag' to be defined")
      }

      const compactJwe = `${encodedHeader}..${TypedArrayEncoder.toBase64URL(encrypted.iv)}.${TypedArrayEncoder.toBase64URL(
        encrypted.encrypted
      )}.${TypedArrayEncoder.toBase64URL(encrypted.tag)}`

      return { encryptionJwk: jweEncryptor.publicJwk, jwe: compactJwe }
    } finally {
      // Delete the key
      await kms.deleteKey({
        keyId: ephmeralKey.keyId,
      })
    }
  }
}

export function getOid4vcDecryptJweCallback(agentContext: AgentContext): DecryptJweCallback {
  const kms = agentContext.resolve(Kms.KeyManagementApi)
  return async (jwe, options) => {
    // TODO: use custom header zod schema to limit which algorithms can be used
    const { header } = decodeJwtHeader({ jwt: jwe })

    let kid = options?.jwk?.kid ?? header.kid
    if (!kid) {
      throw new CredoError('Uanbel to decrypt jwe. No kid or jwk found')
    }

    // Previously we used the fingerprint as the kid for JARM
    // We try to parse it as fingerprint if it starts with z (base58 encoding)
    // It's not 100%
    if (kid.startsWith('z')) {
      try {
        const publicJwk = Kms.PublicJwk.fromFingerprint(kid)
        if (publicJwk) kid = publicJwk.legacyKeyId
      } catch {
        // no-op
      }
    }

    // TODO: decodeJwe method in oid4vc-ts
    // encryption key is not used (we don't use key wrapping)
    const [encodedHeader /* encryptionKey */, , encodedIv, encodedCiphertext, encodedTag] = jwe.split('.')

    if (header.alg !== 'ECDH-ES') {
      throw new CredoError("Only 'ECDH-ES' is supported as 'alg' value for JARM response decryption")
    }

    if (header.enc !== 'A256GCM' && header.enc !== 'A128GCM' && header.enc !== 'A128CBC-HS256') {
      throw new CredoError(
        "Only 'A256GCM', 'A128GCM', and 'A128CBC-HS256' is supported as 'enc' value for JARM response decryption"
      )
    }

    let decryptedPayload: string
    let publicJwk: Kms.PublicJwk

    const epk = Kms.PublicJwk.fromUnknown(header.epk)

    try {
      const decrypted = await kms.decrypt({
        encrypted: TypedArrayEncoder.fromBase64(encodedCiphertext),
        decryption: {
          algorithm: header.enc,
          // aad is the base64 encoded bytes (not just the bytes)
          aad: TypedArrayEncoder.fromString(encodedHeader),
          iv: TypedArrayEncoder.fromBase64(encodedIv),
          tag: TypedArrayEncoder.fromBase64(encodedTag),
        },
        key: {
          keyAgreement: {
            algorithm: header.alg,
            externalPublicJwk: epk.toJson() as Kms.KmsJwkPublicEcdh,
            keyId: kid,
            apu: typeof header.apu === 'string' ? TypedArrayEncoder.fromBase64(header.apu) : undefined,
            apv: typeof header.apv === 'string' ? TypedArrayEncoder.fromBase64(header.apv) : undefined,
          },
        },
      })

      // TODO: decrypt should return the public jwk instance
      publicJwk = Kms.PublicJwk.fromUnknown(
        await kms.getPublicKey({
          keyId: kid,
        })
      )

      decryptedPayload = TypedArrayEncoder.toUtf8String(decrypted.data)
    } catch (error) {
      agentContext.config.logger.error('Error decrypting JWE', {
        error,
      })
      return {
        decrypted: false,
        encryptionJwk: options?.jwk,
        payload: undefined,
        header,
      }
    }

    return {
      decrypted: true,
      decryptionJwk: publicJwk.toJson() as Jwk,
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
        protectedHeaderOptions: { ...header, alg: signer.alg as Kms.KnownJwaSignatureAlgorithm, jwk: undefined },
        payload: JwtPayload.fromJson(payload),
        keyId: signer.kid ?? leafCertificate.publicJwk.keyId,
      })

      return { jwt: jws, signerJwk: leafCertificate.publicJwk.toJson() as Jwk }
    }

    // TOOD: createJwsCompact should return the Jwk, so we don't have to reoslve it here
    const publicJwk =
      signer.method === 'did'
        ? await getPublicJwkFromDid(agentContext, signer.didUrl)
        : Kms.PublicJwk.fromUnknown(signer.publicJwk)

    if (!publicJwk.supportedSignatureAlgorithms.includes(signer.alg as Kms.KnownJwaSignatureAlgorithm)) {
      throw new CredoError(
        `jwk ${publicJwk.jwkTypeHumanDescription} does not support JWS signature alg '${signer.alg}'`
      )
    }

    const jwt = await jwsService.createJwsCompact(agentContext, {
      protectedHeaderOptions: {
        ...header,
        jwk: header.jwk ? publicJwk : undefined,
        alg: signer.alg as Kms.KnownJwaSignatureAlgorithm,
      },
      payload: JsonEncoder.toBuffer(payload),
      keyId: signer.kid ?? publicJwk.keyId,
    })

    return { jwt, signerJwk: publicJwk.toJson() as Jwk }
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
  const kms = agentContext.resolve(Kms.KeyManagementApi)

  return {
    hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
    generateRandom: (length) => kms.randomBytes({ length }),
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
 * authorization server
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
