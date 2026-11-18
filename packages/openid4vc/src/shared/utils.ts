import {
  AgentContext,
  ClaimFormat,
  CredoError,
  type DcqlQuery,
  type DidPurpose,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  Kms,
  TypedArrayEncoder,
  X509Service,
} from '@credo-ts/core'
import type { Jwk, JwkSet, JwtSigner, JwtSignerJwk } from '@openid4vc/oauth2'
import type { CredentialRequestEncryption, IssuerMetadataResult } from '@openid4vc/openid4vci'
import type { OpenId4VcJwtIssuer, OpenId4VcJwtIssuerEncoded } from './models'

export const supportedResponseEncryptionKeyAgreementAlgorithms = [
  'ECDH-ES',
] satisfies Kms.KnownJwaKeyAgreementAlgorithm[]

/**
 * The `enc` values supported for response encryption. Keep in sync with the
 * encrypt/decrypt jwe callbacks.
 */
export const supportedResponseEncryptionContentAlgorithms = [
  'A128GCM',
  'A256GCM',
  'A128CBC-HS256',
] satisfies Kms.KnownJwaContentEncryptionAlgorithm[]

/**
 * Filters a verifier JWK Set to the keys that can actually be used for `ECDH-ES` response
 * encryption by the key management backends of this agent.
 *
 * A verifier can include multiple encryption keys (e.g. `P-256`, `P-384` and `P-521`), and we
 * should only pick a key for which we can perform the key agreement.
 */
export function getSupportedEncryptionJwks(agentContext: AgentContext, jwks: JwkSet): JwkSet {
  const kms = agentContext.resolve(Kms.KeyManagementApi)

  return {
    ...jwks,
    keys: jwks.keys.filter((jwk) => {
      let publicJwk: Kms.PublicJwk
      try {
        publicJwk = Kms.PublicJwk.fromUnknown(jwk)
      } catch {
        return false
      }

      // Only EC and X25519 keys can be used for ECDH (Ed25519 is a signing curve)
      const externalPublicJwk =
        publicJwk.kty === 'EC' || publicJwk.is(Kms.X25519PublicJwk)
          ? (publicJwk.toJson() as Kms.KmsJwkPublicEc | (Kms.KmsJwkPublicOkp & { crv: 'X25519' }))
          : undefined
      if (!externalPublicJwk) return false

      return supportedResponseEncryptionContentAlgorithms.some(
        (algorithm) =>
          kms.supportedBackendsForOperation({
            operation: 'encrypt',
            encryption: { algorithm },
            keyAgreement: {
              algorithm: 'ECDH-ES',
              externalPublicJwk,
            },
          }).length > 0
      )
    }),
  }
}

export function selectCredentialRequestEncryption(
  agentContext: AgentContext,
  metadata: IssuerMetadataResult
): CredentialRequestEncryption | undefined {
  const requestEncryption = metadata.credentialIssuer.credential_request_encryption
  if (!requestEncryption) return undefined

  const keys = requestEncryption.jwks.keys.filter(
    (jwk) =>
      (jwk.use === undefined || jwk.use === 'enc') &&
      jwk.alg !== undefined &&
      (supportedResponseEncryptionKeyAgreementAlgorithms as readonly string[]).includes(jwk.alg)
  )
  const [jwk] = getSupportedEncryptionJwks(agentContext, { keys }).keys
  const enc = supportedResponseEncryptionContentAlgorithms.find((enc) =>
    requestEncryption.enc_values_supported.includes(enc)
  )
  if (!jwk?.kid || !enc) return undefined

  return { kid: jwk.kid, enc }
}

export function getCredentialRequestEncryption(
  agentContext: AgentContext,
  metadata: IssuerMetadataResult,
  hasResponseEncryption: boolean
): CredentialRequestEncryption | undefined {
  const requestEncryption = metadata.credentialIssuer.credential_request_encryption
  if (!requestEncryption || (!requestEncryption.encryption_required && !hasResponseEncryption)) return undefined

  const credentialRequestEncryption = selectCredentialRequestEncryption(agentContext, metadata)
  if (!credentialRequestEncryption) {
    throw new CredoError(
      `Credential issuer '${metadata.credentialIssuer.credential_issuer}' does not advertise a credential request encryption key and enc value supported by Credo (alg ${supportedResponseEncryptionKeyAgreementAlgorithms.join(', ')}, enc ${supportedResponseEncryptionContentAlgorithms.join(', ')})`
    )
  }

  return credentialRequestEncryption
}

export async function getPublicJwkFromDid(
  agentContext: AgentContext,
  didUrl: string,
  allowedPurposes: DidPurpose[] = ['authentication']
): Promise<Kms.PublicJwk> {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, allowedPurposes)

  return getPublicJwkFromVerificationMethod(verificationMethod)
}

// shortcut: the backend travels as an extra property on the signer, which @openid4vc/oauth2 passes to the sign callback
// by reference. Move it to the signer `context` once identity-common releases it.
export type CredoJwtSigner = JwtSigner & { kmsBackend?: string }

export function withKmsBackend<Signer extends JwtSigner>(signer: Signer, kmsBackend: string | undefined): Signer {
  return Object.assign(signer, { kmsBackend })
}

/**
 * The `kid` Credo publishes for its own keys: the JWK thumbprint (RFC 7638), so the KMS key id stays internal.
 */
export function getThumbprintKid(publicJwk: Kms.PublicJwk | Kms.KmsJwkPublic) {
  const jwk = publicJwk instanceof Kms.PublicJwk ? publicJwk : Kms.PublicJwk.fromUnknown(publicJwk)
  return TypedArrayEncoder.toBase64Url(jwk.getJwkThumbprint())
}

/**
 * The jwk Credo publishes for one of its own keys: without the KMS key id, with {@link getThumbprintKid} as `kid`.
 */
export function getPublishedJwk(publicJwk: Kms.PublicJwk | Kms.KmsJwkPublic) {
  const jwk = publicJwk instanceof Kms.PublicJwk ? publicJwk : Kms.PublicJwk.fromUnknown(publicJwk)
  return { ...jwk.toJson({ includeKid: false }), kid: getThumbprintKid(jwk) }
}

/**
 * A `jwk` signer whose `publicJwk` has no `kid`, so the KMS key id stays off the wire. The KMS signs with the signer
 * `kid` and `kmsBackend`.
 */
export function getJwkSigner(publicJwk: Kms.PublicJwk, alg: string) {
  return withKmsBackend(
    {
      method: 'jwk',
      alg,
      publicJwk: publicJwk.toJson({ includeKid: false }) as Jwk,
      kid: publicJwk.hasKeyId ? publicJwk.keyId : undefined,
    } satisfies JwtSignerJwk,
    publicJwk.kmsBackend
  )
}

/**
 * The public key of a `jwk` signer from {@link getJwkSigner}, with the KMS key id and backend it signs with.
 */
export function getJwkSignerKey(signer: JwtSignerJwk): Kms.PublicJwk {
  const publicJwk = Kms.PublicJwk.fromUnknown(signer.kid ? { ...signer.publicJwk, kid: signer.kid } : signer.publicJwk)
  publicJwk.kmsBackend = (signer as CredoJwtSigner).kmsBackend
  return publicJwk
}

/**
 * The access token header gets the `kid` of the signer `publicJwk`, which is the `kid` the JWKS publishes.
 */
export function getAccessTokenSigner(publicJwk: Kms.PublicJwk) {
  const signer = getJwkSigner(publicJwk, publicJwk.supportedSignatureAlgorithms[0])
  return { ...signer, publicJwk: getPublishedJwk(publicJwk) as Jwk }
}

export function encodeJwtIssuer(jwtIssuer: OpenId4VcJwtIssuer): OpenId4VcJwtIssuerEncoded {
  if (jwtIssuer.method === 'jwk') {
    return {
      method: 'jwk',
      jwk: jwtIssuer.jwk.toJson({ includeKid: false }),
      keyId: jwtIssuer.jwk.keyId,
      kmsBackend: jwtIssuer.jwk.kmsBackend,
    }
  }

  if (jwtIssuer.method === 'x5c') {
    return {
      method: 'x5c',
      leafCertificateKeyId: jwtIssuer.x5c[0].keyId,
      leafCertificateKmsBackend: jwtIssuer.x5c[0].kmsBackend,
      x5c: jwtIssuer.x5c.map((c) => c.toString('base64')),
    }
  }

  return jwtIssuer
}

export function decodeJwtIssuer(
  agentContext: AgentContext,
  encodedJwtIssuer: OpenId4VcJwtIssuerEncoded
): OpenId4VcJwtIssuer {
  if (encodedJwtIssuer.method === 'jwk') {
    const jwk = Kms.PublicJwk.fromUnknown(encodedJwtIssuer.jwk)
    if (encodedJwtIssuer.keyId) jwk.keyId = encodedJwtIssuer.keyId
    jwk.kmsBackend = encodedJwtIssuer.kmsBackend
    return { method: 'jwk', jwk }
  }

  if (encodedJwtIssuer.method === 'x5c') {
    return {
      method: 'x5c',
      x5c: encodedJwtIssuer.x5c.map((e, i) => {
        const c = X509Service.parseCertificate(agentContext, { encodedCertificate: e })
        if (i === 0) {
          c.keyId = encodedJwtIssuer.leafCertificateKeyId
          c.kmsBackend = encodedJwtIssuer.leafCertificateKmsBackend
        }
        return c
      }),
    }
  }

  return encodedJwtIssuer
}

export async function credoJwtIssuerToOpenId4VcJwtIssuer(
  agentContext: AgentContext,
  createJwtIssuer: OpenId4VcJwtIssuer
): Promise<CredoJwtSigner> {
  if (createJwtIssuer.method === 'did') {
    const dids = agentContext.resolve(DidsApi)
    const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(createJwtIssuer.didUrl)

    return {
      method: createJwtIssuer.method,
      didUrl: createJwtIssuer.didUrl,
      alg: publicJwk.signatureAlgorithm,
      kid: publicJwk.keyId,
      kmsBackend: publicJwk.kmsBackend,
    }
  }
  if (createJwtIssuer.method === 'x5c') {
    const leafCertificate = createJwtIssuer.x5c[0]
    if (!leafCertificate) {
      throw new CredoError('Unable to extract leaf certificate, x5c certificate chain is empty')
    }

    return {
      ...createJwtIssuer,
      x5c: createJwtIssuer.x5c.map((certificate) => certificate.toString('base64')),
      alg: leafCertificate.publicJwk.signatureAlgorithm,
      kid: leafCertificate.publicJwk.keyId,
      kmsBackend: leafCertificate.kmsBackend,
    }
  }
  if (createJwtIssuer.method === 'jwk') {
    return getJwkSigner(createJwtIssuer.jwk, createJwtIssuer.jwk.signatureAlgorithm)
  }

  throw new CredoError(`Unsupported jwt issuer method '${(createJwtIssuer as OpenId4VcJwtIssuer).method}'`)
}

export function parseIfJson<T>(input: T): T | Record<string, unknown> {
  if (typeof input !== 'string') {
    return input
  }

  try {
    // Try to parse the string as JSON
    return JSON.parse(input)
  } catch (_error) {
    /* empty */
  }

  return input
}

export function dcqlCredentialQueryToPresentationFormat(credential: DcqlQuery['credentials'][number]) {
  switch (credential.format) {
    case 'dc+sd-jwt':
      return ClaimFormat.SdJwtDc
    case 'vc+sd-jwt':
      if (credential.meta && 'type_values' in credential.meta) {
        return ClaimFormat.SdJwtW3cVp
      }

      return ClaimFormat.SdJwtDc
    case 'jwt_vc_json':
      return ClaimFormat.JwtVp
    case 'ldp_vc':
      return ClaimFormat.LdpVp
    case 'mso_mdoc':
      return ClaimFormat.MsoMdoc
  }
}
