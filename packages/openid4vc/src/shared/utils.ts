import {
  AgentContext,
  ClaimFormat,
  CredoError,
  type DcqlQuery,
  type DidPurpose,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  Kms,
  SignatureSuiteRegistry,
  X509Certificate,
} from '@credo-ts/core'
import type { Jwk, JwkSet, JwtSigner } from '@openid4vc/oauth2'
import type { OpenId4VcJwtIssuer, OpenId4VcJwtIssuerEncoded } from './models'

/**
 * The `enc` values supported for JARM response encryption. Keep in sync with the
 * encrypt/decrypt jwe callbacks.
 */
export const supportedJarmContentEncryptionAlgorithms = [
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
export function getSupportedResponseEncryptionJwks(agentContext: AgentContext, jwks: JwkSet): JwkSet {
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

      return supportedJarmContentEncryptionAlgorithms.some(
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

/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 */
export function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): Kms.KnownJwaSignatureAlgorithm[] {
  const kms = agentContext.resolve(Kms.KeyManagementApi)

  // If we can sign with an algorithm we assume it's supported (also for verification)
  const supportedJwaSignatureAlgorithms = Object.values(Kms.KnownJwaSignatureAlgorithms).filter(
    (algorithm) => kms.supportedBackendsForOperation({ operation: 'sign', algorithm }).length > 0
  )

  return supportedJwaSignatureAlgorithms
}

export async function getPublicJwkFromDid(
  agentContext: AgentContext,
  didUrl: string,
  allowedPurposes: DidPurpose[] = ['authentication']
) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, allowedPurposes)

  return getPublicJwkFromVerificationMethod(verificationMethod)
}

export function encodeJwtIssuer(jwtIssuer: OpenId4VcJwtIssuer): OpenId4VcJwtIssuerEncoded {
  if (jwtIssuer.method === 'jwk') {
    return {
      method: 'jwk',
      jwk: jwtIssuer.jwk.toJson(),
    }
  }

  if (jwtIssuer.method === 'x5c') {
    return {
      method: 'x5c',
      leafCertificateKeyId: jwtIssuer.x5c[0].keyId,
      x5c: jwtIssuer.x5c.map((c) => c.toString('base64')),
    }
  }

  return jwtIssuer
}

export function decodeJwtIssuer(encodedJwtIssuer: OpenId4VcJwtIssuerEncoded): OpenId4VcJwtIssuer {
  if (encodedJwtIssuer.method === 'jwk') {
    return {
      method: 'jwk',
      jwk: Kms.PublicJwk.fromUnknown(encodedJwtIssuer.jwk),
    }
  }

  if (encodedJwtIssuer.method === 'x5c') {
    return {
      method: 'x5c',
      x5c: encodedJwtIssuer.x5c.map((e, i) => {
        const c = X509Certificate.fromEncodedCertificate(e)
        if (i === 0) c.keyId = encodedJwtIssuer.leafCertificateKeyId
        return c
      }),
    }
  }

  return encodedJwtIssuer
}

export async function credoJwtIssuerToOpenId4VcJwtIssuer(
  agentContext: AgentContext,
  createJwtIssuer: OpenId4VcJwtIssuer
): Promise<JwtSigner> {
  if (createJwtIssuer.method === 'did') {
    const dids = agentContext.resolve(DidsApi)
    const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(createJwtIssuer.didUrl)

    return {
      method: createJwtIssuer.method,
      didUrl: createJwtIssuer.didUrl,
      alg: publicJwk.signatureAlgorithm,
      kid: publicJwk.keyId,
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
    }
  }
  if (createJwtIssuer.method === 'jwk') {
    return {
      ...createJwtIssuer,
      publicJwk: createJwtIssuer.jwk.toJson() as Jwk,
      alg: createJwtIssuer.jwk.signatureAlgorithm,
    }
  }

  throw new CredoError(`Unsupported jwt issuer method '${(createJwtIssuer as OpenId4VcJwtIssuer).method}'`)
}

export function getProofTypeFromPublicJwk(agentContext: AgentContext, key: Kms.PublicJwk) {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getAllByPublicJwkType(key)
  if (supportedSignatureSuites.length === 0) {
    throw new CredoError(`Couldn't find a supported signature suite for the given key ${key.jwkTypeHumanDescription}.`)
  }

  return supportedSignatureSuites[0].proofType
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
